import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "../../db/client.js";
import { orders, trades } from "../../db/schema.js";
import { toPositiveAmount } from "../../lib/amount.js";
import { AppError } from "../../lib/errors.js";
import { createLedgerTransaction, getWalletByUserAndAssetOrThrow, moveWalletBalance } from "../ledger/ledger.service.js";

type TakeOrderInput = {
  amount?: number;
  idempotencyKey?: string;
};

export async function takeOrder(userId: number, orderId: number, input: TakeOrderInput) {
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), inArray(orders.status, ["OPEN", "PARTIALLY_FILLED"])),
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
    throw new AppError(404, "Order not found or unavailable");
  }

  if (order.userId === userId) {
    throw new AppError(400, "Cannot take your own order");
  }

  const amount = toPositiveAmount(input.amount ?? order.baseAmountRemaining, "amount");
  if (amount > order.baseAmountRemaining) {
    throw new AppError(400, "amount exceeds remaining order amount");
  }

  const quoteAmount = Number((amount * order.price).toFixed(8));
  const idempotencyKey = input.idempotencyKey ?? randomUUID();

  const result = await db.transaction(async (tx) => {
    const buyerUserId = order.side === "SELL" ? userId : order.userId;
    const sellerUserId = order.side === "SELL" ? order.userId : userId;

    const lockAssetId = order.side === "SELL" ? order.market.quoteAssetId : order.market.baseAssetId;
    const lockAmount = order.side === "SELL" ? quoteAmount : amount;

    const takerWallet = await getWalletByUserAndAssetOrThrow(tx, userId, lockAssetId);
    if (takerWallet.availableBalance < lockAmount) {
      throw new AppError(400, "Insufficient balance to take order");
    }

    const [trade] = await tx
      .insert(trades)
      .values({
        orderId: order.id,
        makerUserId: order.userId,
        takerUserId: userId,
        buyerUserId,
        sellerUserId,
        price: order.price,
        baseAmount: amount,
        quoteAmount,
        status: "MATCHED",
        idempotencyKey,
      })
      .returning();

    if (!trade) {
      throw new AppError(500, "Failed to create trade");
    }

    const lockLedgerTxId = await createLedgerTransaction(tx, {
      txType: "TRADE_LOCK",
      referenceType: "trades",
      referenceId: trade.id,
      idempotencyKey: `${idempotencyKey}:trade-lock`,
      createdByUserId: userId,
    });

    await moveWalletBalance({
      tx,
      walletId: takerWallet.id,
      ledgerTxId: lockLedgerTxId,
      deltaAvailable: -lockAmount,
      deltaLocked: lockAmount,
      entryType: "LOCK",
      amount: lockAmount,
    });

    const nextRemaining = Number((order.baseAmountRemaining - amount).toFixed(8));
    await tx
      .update(orders)
      .set({
        baseAmountRemaining: nextRemaining,
        status: nextRemaining === 0 ? "FILLED" : "PARTIALLY_FILLED",
        updatedAt: Date.now(),
      })
      .where(eq(orders.id, order.id));

    return trade;
  });

  return db.query.trades.findFirst({
    where: eq(trades.id, result.id),
    with: {
      order: {
        with: {
          market: {
            with: {
              baseAsset: true,
              quoteAsset: true,
            },
          },
        },
      },
      buyerUser: true,
      sellerUser: true,
    },
  });
}

export async function markTradePaid(userId: number, tradeId: number, paymentRef?: string) {
  const trade = await db.query.trades.findFirst({
    where: eq(trades.id, tradeId),
  });

  if (!trade) {
    throw new AppError(404, "Trade not found");
  }

  if (trade.buyerUserId !== userId) {
    throw new AppError(403, "Only buyer can mark paid");
  }

  if (trade.status !== "MATCHED") {
    throw new AppError(400, "Trade cannot be marked paid in current status");
  }

  await db
    .update(trades)
    .set({
      status: "PAID",
      paymentRef: paymentRef ?? null,
      paidAt: Date.now(),
      updatedAt: Date.now(),
    })
    .where(eq(trades.id, tradeId));

  return db.query.trades.findFirst({
    where: eq(trades.id, tradeId),
  });
}

export async function releaseTrade(userId: number, tradeId: number) {
  const trade = await db.query.trades.findFirst({
    where: eq(trades.id, tradeId),
    with: {
      order: {
        with: {
          market: true,
        },
      },
    },
  });

  if (!trade) {
    throw new AppError(404, "Trade not found");
  }

  if (trade.sellerUserId !== userId) {
    throw new AppError(403, "Only seller can release trade");
  }

  if (trade.status !== "PAID") {
    throw new AppError(400, "Trade must be PAID before release");
  }

  const settlementKey = randomUUID();

  await db.transaction(async (tx) => {
    const sellerBaseWallet = await getWalletByUserAndAssetOrThrow(tx, trade.sellerUserId, trade.order.market.baseAssetId);
    const buyerBaseWallet = await getWalletByUserAndAssetOrThrow(tx, trade.buyerUserId, trade.order.market.baseAssetId);
    const buyerQuoteWallet = await getWalletByUserAndAssetOrThrow(tx, trade.buyerUserId, trade.order.market.quoteAssetId);
    const sellerQuoteWallet = await getWalletByUserAndAssetOrThrow(tx, trade.sellerUserId, trade.order.market.quoteAssetId);

    if (sellerBaseWallet.lockedBalance < trade.baseAmount) {
      throw new AppError(400, "Seller locked base balance is insufficient");
    }
    if (buyerQuoteWallet.lockedBalance < trade.quoteAmount) {
      throw new AppError(400, "Buyer locked quote balance is insufficient");
    }

    const ledgerTxId = await createLedgerTransaction(tx, {
      txType: "TRADE_SETTLEMENT",
      referenceType: "trades",
      referenceId: trade.id,
      idempotencyKey: `${settlementKey}:trade-settlement`,
      createdByUserId: userId,
    });

    await moveWalletBalance({
      tx,
      walletId: sellerBaseWallet.id,
      ledgerTxId,
      deltaAvailable: 0,
      deltaLocked: -trade.baseAmount,
      entryType: "UNLOCK",
      amount: trade.baseAmount,
    });

    await moveWalletBalance({
      tx,
      walletId: buyerBaseWallet.id,
      ledgerTxId,
      deltaAvailable: trade.baseAmount,
      deltaLocked: 0,
      entryType: "CREDIT",
      amount: trade.baseAmount,
    });

    await moveWalletBalance({
      tx,
      walletId: buyerQuoteWallet.id,
      ledgerTxId,
      deltaAvailable: 0,
      deltaLocked: -trade.quoteAmount,
      entryType: "UNLOCK",
      amount: trade.quoteAmount,
    });

    await moveWalletBalance({
      tx,
      walletId: sellerQuoteWallet.id,
      ledgerTxId,
      deltaAvailable: trade.quoteAmount,
      deltaLocked: 0,
      entryType: "CREDIT",
      amount: trade.quoteAmount,
    });

    await tx
      .update(trades)
      .set({
        status: "COMPLETED",
        releasedAt: Date.now(),
        completedAt: Date.now(),
        updatedAt: Date.now(),
      })
      .where(eq(trades.id, trade.id));
  });

  return db.query.trades.findFirst({
    where: eq(trades.id, trade.id),
    with: {
      order: {
        with: {
          market: {
            with: {
              baseAsset: true,
              quoteAsset: true,
            },
          },
        },
      },
      buyerUser: true,
      sellerUser: true,
    },
  });
}

export async function listMyTrades(userId: number) {
  return db.query.trades.findMany({
    where: or(eq(trades.buyerUserId, userId), eq(trades.sellerUserId, userId)),
    with: {
      order: {
        with: {
          market: {
            with: {
              baseAsset: true,
              quoteAsset: true,
            },
          },
        },
      },
      buyerUser: true,
      sellerUser: true,
    },
    orderBy: desc(trades.createdAt),
    limit: 100,
  });
}
