import { randomUUID } from "node:crypto";
import { desc, eq, or } from "drizzle-orm";
import { db } from "../../db/client.js";
import { assets, internalTransfers } from "../../db/schema.js";
import { toPositiveAmount } from "../../lib/amount.js";
import { AppError } from "../../lib/errors.js";
import { createLedgerTransaction, getWalletByUserAndAssetOrThrow, moveWalletBalance } from "../ledger/ledger.service.js";

type CreateInternalTransferInput = {
  toUserId: number;
  assetCode: string;
  amount: number;
  note?: string;
  idempotencyKey?: string;
};

export async function createInternalTransfer(userId: number, input: CreateInternalTransferInput) {
  if (input.toUserId === userId) {
    throw new AppError(400, "Cannot transfer to yourself");
  }

  const amount = toPositiveAmount(input.amount, "amount");
  const assetCode = input.assetCode.trim().toUpperCase();
  const idempotencyKey = input.idempotencyKey ?? randomUUID();

  const asset = await db.query.assets.findFirst({
    where: eq(assets.code, assetCode),
  });
  if (!asset) {
    throw new AppError(404, "Asset not found");
  }

  const transfer = await db.transaction(async (tx) => {
    const fromWallet = await getWalletByUserAndAssetOrThrow(tx, userId, asset.id);
    const toWallet = await getWalletByUserAndAssetOrThrow(tx, input.toUserId, asset.id);

    if (fromWallet.availableBalance < amount) {
      throw new AppError(400, "Insufficient balance");
    }

    const [created] = await tx
      .insert(internalTransfers)
      .values({
        fromUserId: userId,
        toUserId: input.toUserId,
        assetId: asset.id,
        amount,
        status: "COMPLETED",
        note: input.note ?? null,
        idempotencyKey,
        completedAt: Date.now(),
      })
      .returning();

    if (!created) {
      throw new AppError(500, "Failed to create transfer");
    }

    const ledgerTxId = await createLedgerTransaction(tx, {
      txType: "INTERNAL_TRANSFER",
      referenceType: "internal_transfers",
      referenceId: created.id,
      idempotencyKey: `${idempotencyKey}:internal-transfer`,
      createdByUserId: userId,
    });

    await moveWalletBalance({
      tx,
      walletId: fromWallet.id,
      ledgerTxId,
      deltaAvailable: -amount,
      deltaLocked: 0,
      entryType: "DEBIT",
      amount,
    });

    await moveWalletBalance({
      tx,
      walletId: toWallet.id,
      ledgerTxId,
      deltaAvailable: amount,
      deltaLocked: 0,
      entryType: "CREDIT",
      amount,
    });

    return created;
  });

  return db.query.internalTransfers.findFirst({
    where: eq(internalTransfers.id, transfer.id),
    with: {
      fromUser: true,
      toUser: true,
      asset: true,
    },
  });
}

export async function listMyInternalTransfers(userId: number) {
  return db.query.internalTransfers.findMany({
    where: or(eq(internalTransfers.fromUserId, userId), eq(internalTransfers.toUserId, userId)),
    with: {
      fromUser: true,
      toUser: true,
      asset: true,
    },
    orderBy: desc(internalTransfers.createdAt),
    limit: 100,
  });
}
