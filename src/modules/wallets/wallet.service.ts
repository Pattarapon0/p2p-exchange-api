import { listTransactionsByUser } from "../ledger/ledger.service.js";
import { walletRepository } from "./wallet.repository.js";

export async function getWalletsByUser(userId: number) {
  const rows = await walletRepository.listByUser(userId);
  return rows.map((row) => ({
    walletId: row.id,
    assetCode: row.asset.code,
    assetType: row.asset.type,
    availableBalance: row.availableBalance,
    lockedBalance: row.lockedBalance,
    updatedAt: row.updatedAt,
  }));
}

export async function getWalletTransactions(userId: number, limit = 100) {
  return listTransactionsByUser(userId, limit);
}
