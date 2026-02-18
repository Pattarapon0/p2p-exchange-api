import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { markets, orders } from "../../db/schema.js";
import { toAmountOrZero, toPositiveAmount } from "../../lib/amount.js";
import { AppError } from "../../lib/errors.js";
import { createLedgerTransaction, getWalletByUserAndAssetOrThrow, moveWalletBalance } from "../ledger/ledger.service.js";
import { orderRepository } from "./order.repository.js";

type CreateOrderInput = {
  side: "BUY" | "SELL";
  marketId: number;
  price: number;
  amount: number;
  minQuoteAmount?: number;
  maxQuoteAmount?: number;
  expiresAt?: number | null;
  idempotencyKey?: string;
};

export async function listMarkets() {
  const rows = await db.query.markets.findMany({
    with: {
      baseAsset: true,
      quoteAsset: true,
    },
  });

  return rows.map((row) => ({
    marketId: row.id,
    baseAsset: row.baseAsset.code,
    quoteAsset: row.quoteAsset.code,
    isActive: row.isActive,
  }));
}

export async function createOrder(userId: number, input: CreateOrderInput) {
  const side = input.side;
  if (side !== "BUY" && side !== "SELL") {
    throw new AppError(400, "side must be BUY or SELL");
  }

  const market = await db.query.markets.findFirst({
    where: and(eq(markets.id, input.marketId), eq(markets.isActive, true)),
    with: {
      baseAsset: true,
      quoteAsset: true,
    },
  });

  if (!market) {
    throw new AppError(404, "Market not found");
  }

  const baseAmount = toPositiveAmount(input.amount, "amount");
  const price = toPositiveAmount(input.price, "price");
  const quoteAmountToLock = Number((baseAmount * price).toFixed(8));
  const minQuoteAmount = toAmountOrZero(input.minQuoteAmount ?? 0);
  const maxQuoteAmount = input.maxQuoteAmount == null ? null : toPositiveAmount(input.maxQuoteAmount, "maxQuoteAmount");
  const idempotencyKey = input.idempotencyKey ?? randomUUID();

  const order = await db.transaction(async (tx) => {
    const [createdOrder] = await tx
      .insert(orders)
      .values({
        userId,
        marketId: market.id,
        side,
        price,
        baseAmountTotal: baseAmount,
        baseAmountRemaining: baseAmount,
        minQuoteAmount,
        maxQuoteAmount,
        expiresAt: input.expiresAt ?? null,
      })
      .returning();

    if (!createdOrder) {
      throw new AppError(500, "Failed to create order");
    }

    if (side === "SELL") {
      const wallet = await getWalletByUserAndAssetOrThrow(tx, userId, market.baseAssetId);
      if (wallet.availableBalance < baseAmount) {
        throw new AppError(400, "Insufficient asset balance for SELL order");
      }

      const ledgerTxId = await createLedgerTransaction(tx, {
        txType: "ORDER_LOCK",
        referenceType: "orders",
        referenceId: createdOrder.id,
        idempotencyKey: `${idempotencyKey}:order-lock`,
        createdByUserId: userId,
      });

      await moveWalletBalance({
        tx,
        walletId: wallet.id,
        ledgerTxId,
        deltaAvailable: -baseAmount,
        deltaLocked: baseAmount,
        entryType: "LOCK",
        amount: baseAmount,
      });
    } else {
      const wallet = await getWalletByUserAndAssetOrThrow(tx, userId, market.quoteAssetId);
      if (wallet.availableBalance < quoteAmountToLock) {
        throw new AppError(400, "Insufficient fiat balance for BUY order");
      }

      const ledgerTxId = await createLedgerTransaction(tx, {
        txType: "ORDER_LOCK",
        referenceType: "orders",
        referenceId: createdOrder.id,
        idempotencyKey: `${idempotencyKey}:order-lock`,
        createdByUserId: userId,
      });

      await moveWalletBalance({
        tx,
        walletId: wallet.id,
        ledgerTxId,
        deltaAvailable: -quoteAmountToLock,
        deltaLocked: quoteAmountToLock,
        entryType: "LOCK",
        amount: quoteAmountToLock,
      });
    }

    return createdOrder;
  });

  return orderRepository.findByIdWithRelations(order.id);
}

export async function listOpenOrders() {
  return orderRepository.listOpen();
}

export async function listMyOrders(userId: number) {
  return orderRepository.listByUser(userId);
}

export async function cancelOrder(userId: number, orderId: number) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      market: {
        with: {
          baseAsset: true,
          quoteAsset: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError(404, "Order not found");
  }

  if (order.userId !== userId) {
    throw new AppError(403, "You can cancel only your own order");
  }

  if (!["OPEN", "PARTIALLY_FILLED"].includes(order.status)) {
    throw new AppError(400, "Order cannot be cancelled");
  }

  const remainingBase = Number(order.baseAmountRemaining.toFixed(8));
  if (remainingBase <= 0) {
    throw new AppError(400, "No remaining amount to cancel");
  }

  const unlockAmount = order.side === "SELL" ? remainingBase : Number((remainingBase * order.price).toFixed(8));

  const idempotencyKey = randomUUID();

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: "CANCELLED",
        updatedAt: Date.now(),
      })
      .where(eq(orders.id, order.id));

    const walletAssetId = order.side === "SELL" ? order.market.baseAssetId : order.market.quoteAssetId;
    const wallet = await getWalletByUserAndAssetOrThrow(tx, userId, walletAssetId);

    const ledgerTxId = await createLedgerTransaction(tx, {
      txType: "ORDER_UNLOCK",
      referenceType: "orders",
      referenceId: order.id,
      idempotencyKey: `${idempotencyKey}:order-unlock`,
      createdByUserId: userId,
    });

    await moveWalletBalance({
      tx,
      walletId: wallet.id,
      ledgerTxId,
      deltaAvailable: unlockAmount,
      deltaLocked: -unlockAmount,
      entryType: "UNLOCK",
      amount: unlockAmount,
    });
  });

  return orderRepository.findByIdWithRelations(order.id);
}
