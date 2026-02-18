import { and, count, eq } from "drizzle-orm";
import { ensureReferenceData } from "../src/db/bootstrap.js";
import { client, db } from "../src/db/client.js";
import { hashPassword } from "../src/lib/password.js";
import { createOrder } from "../src/modules/orders/order.service.js";
import { markTradePaid, releaseTrade, takeOrder } from "../src/modules/trades/trade.service.js";
import { createInternalTransfer } from "../src/modules/transfers/transfer.service.js";
import { createWithdrawal } from "../src/modules/withdrawals/withdrawal.service.js";
import { assets, orders, users, wallets } from "../src/db/schema.js";

const MOCK_USERS = [
  { email: "alice@example.com", password: "Password123!" },
  { email: "bob@example.com", password: "Password123!" },
  { email: "carol@example.com", password: "Password123!" },
  { email: "dave@example.com", password: "Password123!" },
];

async function upsertUsers() {
  for (const user of MOCK_USERS) {
    const passwordHash = await hashPassword(user.password);
    await db
      .insert(users)
      .values({
        email: user.email,
        passwordHash,
      })
      .onConflictDoNothing();
  }
}

async function ensureWallets() {
  const userRows = await db.select().from(users);
  const assetRows = await db.select().from(assets);

  for (const user of userRows) {
    for (const asset of assetRows) {
      await db
        .insert(wallets)
        .values({
          userId: user.id,
          assetId: asset.id,
          availableBalance: 0,
          lockedBalance: 0,
        })
        .onConflictDoNothing();
    }
  }
}

async function seedBalances() {
  const userRows = await db.select().from(users);
  const assetRows = await db.select().from(assets);

  const userMap = new Map(userRows.map((user) => [user.email, user.id]));

  for (const user of userRows) {
    for (const asset of assetRows) {
      const wallet = await db.query.wallets.findFirst({
        where: and(eq(wallets.userId, user.id), eq(wallets.assetId, asset.id)),
      });
      if (!wallet) continue;

      let availableBalance = 0;
      if (asset.type === "FIAT") availableBalance = 500000;
      if (asset.code === "BTC") availableBalance = 1.5;
      if (asset.code === "ETH") availableBalance = 20;
      if (asset.code === "XRP") availableBalance = 20000;
      if (asset.code === "DOGE") availableBalance = 50000;

      if (user.id === userMap.get("alice@example.com")) {
        if (asset.type === "FIAT") availableBalance = 250000;
        if (asset.code === "BTC") availableBalance = 3;
      }

      await db
        .update(wallets)
        .set({
          availableBalance,
          lockedBalance: 0,
          updatedAt: Date.now(),
        })
        .where(eq(wallets.id, wallet.id));
    }
  }
}

async function seedTradingScenario() {
  const [{ value: orderCount }] = await db.select({ value: count() }).from(orders);
  if (orderCount > 0) {
    return;
  }

  const alice = await db.query.users.findFirst({ where: eq(users.email, "alice@example.com") });
  const bob = await db.query.users.findFirst({ where: eq(users.email, "bob@example.com") });
  const carol = await db.query.users.findFirst({ where: eq(users.email, "carol@example.com") });

  if (!alice || !bob || !carol) {
    throw new Error("Missing seeded users");
  }

  const market = await db.query.markets.findFirst({
    with: { baseAsset: true, quoteAsset: true },
  });

  if (!market) {
    throw new Error("No market found. Run migrations and bootstrap first.");
  }

  const createdOrder = await createOrder(alice.id, {
    side: "SELL",
    marketId: market.id,
    price: 2000000,
    amount: 0.2,
    minQuoteAmount: 1000,
    idempotencyKey: "seed-order-1",
  });

  if (!createdOrder?.id) {
    throw new Error("Failed to seed order");
  }

  const createdTrade = await takeOrder(bob.id, createdOrder.id, {
    amount: 0.1,
    idempotencyKey: "seed-trade-1",
  });

  if (!createdTrade?.id) {
    throw new Error("Failed to seed trade");
  }

  await markTradePaid(bob.id, createdTrade.id, "SEED-PAYMENT-001");
  await releaseTrade(alice.id, createdTrade.id);

  await createInternalTransfer(alice.id, {
    toUserId: carol.id,
    assetCode: "XRP",
    amount: 500,
    note: "seed internal transfer",
    idempotencyKey: "seed-transfer-1",
  });

  await createWithdrawal(bob.id, {
    assetCode: "ETH",
    amount: 1.25,
    fee: 0.01,
    network: "ERC20",
    address: "0x1234567890abcdef1234567890abcdef12345678",
    idempotencyKey: "seed-withdrawal-1",
    provider: "demo-provider",
  });
}

async function seed() {
  try {
    await ensureReferenceData();
    await upsertUsers();
    await ensureWallets();
    await seedBalances();
    await seedTradingScenario();
  } catch {
    process.exit(1);
  } finally {
    client.close();
  }
}

await seed();
