import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const nowMs = sql`(unixepoch() * 1000)`;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: integer("created_at").notNull().default(nowMs),
  updatedAt: integer("updated_at").notNull().default(nowMs),
});

export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // FIAT | CRYPTO
  precision: integer("precision").notNull().default(8),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const markets = sqliteTable(
  "markets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    baseAssetId: integer("base_asset_id")
      .notNull()
      .references(() => assets.id),
    quoteAssetId: integer("quote_asset_id")
      .notNull()
      .references(() => assets.id),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => ({
    pairUnique: uniqueIndex("markets_base_quote_idx").on(table.baseAssetId, table.quoteAssetId),
  }),
);

export const wallets = sqliteTable(
  "wallets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id),
    availableBalance: real("available_balance").notNull().default(0),
    lockedBalance: real("locked_balance").notNull().default(0),
    version: integer("version").notNull().default(0),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (table) => ({
    userAssetUnique: uniqueIndex("wallets_user_asset_idx").on(table.userId, table.assetId),
  }),
);

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    marketId: integer("market_id")
      .notNull()
      .references(() => markets.id),
    side: text("side").notNull(), // BUY | SELL
    price: real("price").notNull(),
    baseAmountTotal: real("base_amount_total").notNull(),
    baseAmountRemaining: real("base_amount_remaining").notNull(),
    minQuoteAmount: real("min_quote_amount").notNull().default(0),
    maxQuoteAmount: real("max_quote_amount"),
    status: text("status").notNull().default("OPEN"),
    expiresAt: integer("expires_at"),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (table) => ({
    marketSideStatusIdx: index("orders_market_side_status_idx").on(table.marketId, table.side, table.status),
    userStatusIdx: index("orders_user_status_idx").on(table.userId, table.status),
  }),
);

export const trades = sqliteTable(
  "trades",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id),
    makerUserId: integer("maker_user_id")
      .notNull()
      .references(() => users.id),
    takerUserId: integer("taker_user_id")
      .notNull()
      .references(() => users.id),
    buyerUserId: integer("buyer_user_id")
      .notNull()
      .references(() => users.id),
    sellerUserId: integer("seller_user_id")
      .notNull()
      .references(() => users.id),
    price: real("price").notNull(),
    baseAmount: real("base_amount").notNull(),
    quoteAmount: real("quote_amount").notNull(),
    status: text("status").notNull().default("MATCHED"),
    paymentRef: text("payment_ref"),
    paidAt: integer("paid_at"),
    releasedAt: integer("released_at"),
    completedAt: integer("completed_at"),
    cancelReason: text("cancel_reason"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (table) => ({
    orderIdx: index("trades_order_idx").on(table.orderId),
    buyerStatusIdx: index("trades_buyer_status_idx").on(table.buyerUserId, table.status),
    sellerStatusIdx: index("trades_seller_status_idx").on(table.sellerUserId, table.status),
  }),
);

export const internalTransfers = sqliteTable("internal_transfers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromUserId: integer("from_user_id")
    .notNull()
    .references(() => users.id),
  toUserId: integer("to_user_id")
    .notNull()
    .references(() => users.id),
  assetId: integer("asset_id")
    .notNull()
    .references(() => assets.id),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("PENDING"),
  note: text("note"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: integer("created_at").notNull().default(nowMs),
  completedAt: integer("completed_at"),
});

export const externalWithdrawals = sqliteTable(
  "external_withdrawals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id),
    amount: real("amount").notNull(),
    fee: real("fee").notNull().default(0),
    netAmount: real("net_amount").notNull(),
    network: text("network").notNull(),
    address: text("address").notNull(),
    status: text("status").notNull().default("PENDING"),
    provider: text("provider"),
    providerTxId: text("provider_tx_id"),
    providerStatus: text("provider_status"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    requestedAt: integer("requested_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (table) => ({
    userStatusIdx: index("withdrawals_user_status_idx").on(table.userId, table.status),
    providerTxIdx: index("withdrawals_provider_tx_idx").on(table.providerTxId),
  }),
);

export const ledgerTransactions = sqliteTable(
  "ledger_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    txType: text("tx_type").notNull(),
    referenceType: text("reference_type").notNull(),
    referenceId: integer("reference_id").notNull(),
    status: text("status").notNull().default("POSTED"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdByUserId: integer("created_by_user_id").references(() => users.id),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (table) => ({
    refTypeIdIdx: index("ledger_tx_ref_idx").on(table.referenceType, table.referenceId),
  }),
);

export const ledgerEntries = sqliteTable(
  "ledger_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ledgerTxId: integer("ledger_tx_id")
      .notNull()
      .references(() => ledgerTransactions.id),
    walletId: integer("wallet_id")
      .notNull()
      .references(() => wallets.id),
    entryType: text("entry_type").notNull(), // DEBIT | CREDIT | LOCK | UNLOCK
    amount: real("amount").notNull(),
    availableBefore: real("available_before").notNull(),
    availableAfter: real("available_after").notNull(),
    lockedBefore: real("locked_before").notNull(),
    lockedAfter: real("locked_after").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (table) => ({
    ledgerTxIdx: index("ledger_entries_ledger_tx_idx").on(table.ledgerTxId),
    walletCreatedIdx: index("ledger_entries_wallet_created_idx").on(table.walletId, table.createdAt),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  wallets: many(wallets),
  orders: many(orders),
  makerTrades: many(trades, { relationName: "maker_user" }),
  takerTrades: many(trades, { relationName: "taker_user" }),
  buyerTrades: many(trades, { relationName: "buyer_user" }),
  sellerTrades: many(trades, { relationName: "seller_user" }),
  sentTransfers: many(internalTransfers, { relationName: "transfer_from_user" }),
  receivedTransfers: many(internalTransfers, { relationName: "transfer_to_user" }),
  externalWithdrawals: many(externalWithdrawals),
  ledgerTransactions: many(ledgerTransactions),
}));

export const assetsRelations = relations(assets, ({ many }) => ({
  wallets: many(wallets),
  baseMarkets: many(markets, { relationName: "market_base_asset" }),
  quoteMarkets: many(markets, { relationName: "market_quote_asset" }),
  internalTransfers: many(internalTransfers),
  externalWithdrawals: many(externalWithdrawals),
}));

export const marketsRelations = relations(markets, ({ one, many }) => ({
  baseAsset: one(assets, {
    fields: [markets.baseAssetId],
    references: [assets.id],
    relationName: "market_base_asset",
  }),
  quoteAsset: one(assets, {
    fields: [markets.quoteAssetId],
    references: [assets.id],
    relationName: "market_quote_asset",
  }),
  orders: many(orders),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  asset: one(assets, {
    fields: [wallets.assetId],
    references: [assets.id],
  }),
  ledgerEntries: many(ledgerEntries),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  market: one(markets, {
    fields: [orders.marketId],
    references: [markets.id],
  }),
  trades: many(trades),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  order: one(orders, {
    fields: [trades.orderId],
    references: [orders.id],
  }),
  makerUser: one(users, {
    fields: [trades.makerUserId],
    references: [users.id],
    relationName: "maker_user",
  }),
  takerUser: one(users, {
    fields: [trades.takerUserId],
    references: [users.id],
    relationName: "taker_user",
  }),
  buyerUser: one(users, {
    fields: [trades.buyerUserId],
    references: [users.id],
    relationName: "buyer_user",
  }),
  sellerUser: one(users, {
    fields: [trades.sellerUserId],
    references: [users.id],
    relationName: "seller_user",
  }),
}));

export const internalTransfersRelations = relations(internalTransfers, ({ one }) => ({
  fromUser: one(users, {
    fields: [internalTransfers.fromUserId],
    references: [users.id],
    relationName: "transfer_from_user",
  }),
  toUser: one(users, {
    fields: [internalTransfers.toUserId],
    references: [users.id],
    relationName: "transfer_to_user",
  }),
  asset: one(assets, {
    fields: [internalTransfers.assetId],
    references: [assets.id],
  }),
}));

export const externalWithdrawalsRelations = relations(externalWithdrawals, ({ one }) => ({
  user: one(users, {
    fields: [externalWithdrawals.userId],
    references: [users.id],
  }),
  asset: one(assets, {
    fields: [externalWithdrawals.assetId],
    references: [assets.id],
  }),
}));

export const ledgerTransactionsRelations = relations(ledgerTransactions, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [ledgerTransactions.createdByUserId],
    references: [users.id],
  }),
  entries: many(ledgerEntries),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  ledgerTransaction: one(ledgerTransactions, {
    fields: [ledgerEntries.ledgerTxId],
    references: [ledgerTransactions.id],
  }),
  wallet: one(wallets, {
    fields: [ledgerEntries.walletId],
    references: [wallets.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
