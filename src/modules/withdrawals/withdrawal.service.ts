import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { assets, externalWithdrawals } from "../../db/schema.js";
import { toAmountOrZero, toPositiveAmount } from "../../lib/amount.js";
import { AppError } from "../../lib/errors.js";
import { createLedgerTransaction, getWalletByUserAndAssetOrThrow, moveWalletBalance } from "../ledger/ledger.service.js";

type CreateWithdrawalInput = {
  assetCode: string;
  amount: number;
  fee?: number;
  network: string;
  address: string;
  idempotencyKey?: string;
  provider?: string;
};

export async function createWithdrawal(userId: number, input: CreateWithdrawalInput) {
  const assetCode = input.assetCode.trim().toUpperCase();
  const amount = toPositiveAmount(input.amount, "amount");
  const fee = toAmountOrZero(input.fee ?? 0);
  const totalLock = Number((amount + fee).toFixed(8));
  const idempotencyKey = input.idempotencyKey ?? randomUUID();

  const asset = await db.query.assets.findFirst({
    where: eq(assets.code, assetCode),
  });
  if (!asset) {
    throw new AppError(404, "Asset not found");
  }
  if (asset.type !== "CRYPTO") {
    throw new AppError(400, "Only CRYPTO assets can be withdrawn externally");
  }

  const withdrawal = await db.transaction(async (tx) => {
    const wallet = await getWalletByUserAndAssetOrThrow(tx, userId, asset.id);
    if (wallet.availableBalance < totalLock) {
      throw new AppError(400, "Insufficient balance");
    }

    const [created] = await tx
      .insert(externalWithdrawals)
      .values({
        userId,
        assetId: asset.id,
        amount,
        fee,
        netAmount: amount,
        network: input.network,
        address: input.address,
        status: "PENDING",
        provider: input.provider ?? null,
        idempotencyKey,
      })
      .returning();

    if (!created) {
      throw new AppError(500, "Failed to create withdrawal");
    }

    const ledgerTxId = await createLedgerTransaction(tx, {
      txType: "WITHDRAWAL_LOCK",
      referenceType: "external_withdrawals",
      referenceId: created.id,
      idempotencyKey: `${idempotencyKey}:withdrawal-lock`,
      createdByUserId: userId,
    });

    await moveWalletBalance({
      tx,
      walletId: wallet.id,
      ledgerTxId,
      deltaAvailable: -totalLock,
      deltaLocked: totalLock,
      entryType: "LOCK",
      amount: totalLock,
    });

    return created;
  });

  return db.query.externalWithdrawals.findFirst({
    where: eq(externalWithdrawals.id, withdrawal.id),
    with: {
      asset: true,
    },
  });
}

export async function listMyWithdrawals(userId: number) {
  return db.query.externalWithdrawals.findMany({
    where: eq(externalWithdrawals.userId, userId),
    with: {
      asset: true,
    },
    orderBy: desc(externalWithdrawals.requestedAt),
    limit: 100,
  });
}
