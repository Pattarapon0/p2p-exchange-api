import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { assets, ledgerEntries, ledgerTransactions, wallets } from "../../db/schema.js";

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

type CreateLedgerTxInput = {
  txType: string;
  referenceType: string;
  referenceId: number;
  idempotencyKey: string;
  createdByUserId?: number;
};

type MoveWalletInput = {
  tx: TxClient;
  walletId: number;
  ledgerTxId: number;
  deltaAvailable: number;
  deltaLocked: number;
  entryType: "DEBIT" | "CREDIT" | "LOCK" | "UNLOCK";
  amount: number;
};

export async function createLedgerTransaction(tx: TxClient, payload: CreateLedgerTxInput): Promise<number> {
  const [created] = await tx
    .insert(ledgerTransactions)
    .values({
      txType: payload.txType,
      referenceType: payload.referenceType,
      referenceId: payload.referenceId,
      idempotencyKey: payload.idempotencyKey,
      createdByUserId: payload.createdByUserId,
    })
    .returning({ id: ledgerTransactions.id });

  if (!created) {
    throw new AppError(500, "Failed to create ledger transaction");
  }

  return created.id;
}

export async function getWalletOrThrow(tx: TxClient, walletId: number) {
  const wallet = await tx.query.wallets.findFirst({
    where: eq(wallets.id, walletId),
    with: {
      asset: true,
    },
  });

  if (!wallet) {
    throw new AppError(404, "Wallet not found");
  }

  return wallet;
}

export async function getWalletByUserAndAssetOrThrow(tx: TxClient, userId: number, assetId: number) {
  const wallet = await tx.query.wallets.findFirst({
    where: and(eq(wallets.userId, userId), eq(wallets.assetId, assetId)),
    with: {
      asset: true,
    },
  });

  if (!wallet) {
    throw new AppError(404, "Wallet not found");
  }

  return wallet;
}

export async function moveWalletBalance(input: MoveWalletInput): Promise<void> {
  const wallet = await getWalletOrThrow(input.tx, input.walletId);

  const nextAvailable = Number((wallet.availableBalance + input.deltaAvailable).toFixed(8));
  const nextLocked = Number((wallet.lockedBalance + input.deltaLocked).toFixed(8));

  if (nextAvailable < 0 || nextLocked < 0) {
    throw new AppError(400, "Insufficient balance");
  }

  await input.tx
    .update(wallets)
    .set({
      availableBalance: nextAvailable,
      lockedBalance: nextLocked,
      version: wallet.version + 1,
      updatedAt: Date.now(),
    })
    .where(eq(wallets.id, wallet.id));

  await input.tx.insert(ledgerEntries).values({
    ledgerTxId: input.ledgerTxId,
    walletId: wallet.id,
    entryType: input.entryType,
    amount: input.amount,
    availableBefore: wallet.availableBalance,
    availableAfter: nextAvailable,
    lockedBefore: wallet.lockedBalance,
    lockedAfter: nextLocked,
  });
}

export async function listTransactionsByUser(userId: number, limit = 100) {
  return db
    .select({
      ledgerEntryId: ledgerEntries.id,
      createdAt: ledgerEntries.createdAt,
      txType: ledgerTransactions.txType,
      referenceType: ledgerTransactions.referenceType,
      referenceId: ledgerTransactions.referenceId,
      entryType: ledgerEntries.entryType,
      amount: ledgerEntries.amount,
      availableBefore: ledgerEntries.availableBefore,
      availableAfter: ledgerEntries.availableAfter,
      lockedBefore: ledgerEntries.lockedBefore,
      lockedAfter: ledgerEntries.lockedAfter,
      assetCode: assets.code,
      walletId: wallets.id,
    })
    .from(ledgerEntries)
    .innerJoin(ledgerTransactions, eq(ledgerEntries.ledgerTxId, ledgerTransactions.id))
    .innerJoin(wallets, eq(ledgerEntries.walletId, wallets.id))
    .innerJoin(assets, eq(wallets.assetId, assets.id))
    .where(eq(wallets.userId, userId))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(limit);
}
