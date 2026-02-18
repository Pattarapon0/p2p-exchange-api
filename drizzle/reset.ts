import { client, db } from "../src/db/client.js";
import {
  assets,
  externalWithdrawals,
  internalTransfers,
  ledgerEntries,
  ledgerTransactions,
  markets,
  orders,
  trades,
  users,
  wallets,
} from "../src/db/schema.js";

async function reset() {
  try {
    await client.execute("PRAGMA foreign_keys = OFF");

    await db.delete(ledgerEntries);
    await db.delete(ledgerTransactions);
    await db.delete(trades);
    await db.delete(internalTransfers);
    await db.delete(externalWithdrawals);
    await db.delete(orders);
    await db.delete(wallets);
    await db.delete(markets);
    await db.delete(assets);
    await db.delete(users);

    await client.execute("DELETE FROM sqlite_sequence");
    await client.execute("PRAGMA foreign_keys = ON");
  } catch {
    process.exit(1);
  } finally {
    client.close();
  }
}

await reset();
