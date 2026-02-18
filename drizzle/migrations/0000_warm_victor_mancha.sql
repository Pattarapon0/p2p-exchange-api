CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`precision` integer DEFAULT 8 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_code_unique` ON `assets` (`code`);--> statement-breakpoint
CREATE TABLE `external_withdrawals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`asset_id` integer NOT NULL,
	`amount` real NOT NULL,
	`fee` real DEFAULT 0 NOT NULL,
	`net_amount` real NOT NULL,
	`network` text NOT NULL,
	`address` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`provider` text,
	`provider_tx_id` text,
	`provider_status` text,
	`idempotency_key` text NOT NULL,
	`requested_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_withdrawals_idempotency_key_unique` ON `external_withdrawals` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `withdrawals_user_status_idx` ON `external_withdrawals` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `withdrawals_provider_tx_idx` ON `external_withdrawals` (`provider_tx_id`);--> statement-breakpoint
CREATE TABLE `internal_transfers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_user_id` integer NOT NULL,
	`to_user_id` integer NOT NULL,
	`asset_id` integer NOT NULL,
	`amount` real NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`note` text,
	`idempotency_key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `internal_transfers_idempotency_key_unique` ON `internal_transfers` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ledger_tx_id` integer NOT NULL,
	`wallet_id` integer NOT NULL,
	`entry_type` text NOT NULL,
	`amount` real NOT NULL,
	`available_before` real NOT NULL,
	`available_after` real NOT NULL,
	`locked_before` real NOT NULL,
	`locked_after` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`ledger_tx_id`) REFERENCES `ledger_transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ledger_entries_ledger_tx_idx` ON `ledger_entries` (`ledger_tx_id`);--> statement-breakpoint
CREATE INDEX `ledger_entries_wallet_created_idx` ON `ledger_entries` (`wallet_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ledger_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tx_type` text NOT NULL,
	`reference_type` text NOT NULL,
	`reference_id` integer NOT NULL,
	`status` text DEFAULT 'POSTED' NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_by_user_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_transactions_idempotency_key_unique` ON `ledger_transactions` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `ledger_tx_ref_idx` ON `ledger_transactions` (`reference_type`,`reference_id`);--> statement-breakpoint
CREATE TABLE `markets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`base_asset_id` integer NOT NULL,
	`quote_asset_id` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`base_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quote_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `markets_base_quote_idx` ON `markets` (`base_asset_id`,`quote_asset_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`market_id` integer NOT NULL,
	`side` text NOT NULL,
	`price` real NOT NULL,
	`base_amount_total` real NOT NULL,
	`base_amount_remaining` real NOT NULL,
	`min_quote_amount` real DEFAULT 0 NOT NULL,
	`max_quote_amount` real,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`market_id`) REFERENCES `markets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_market_side_status_idx` ON `orders` (`market_id`,`side`,`status`);--> statement-breakpoint
CREATE INDEX `orders_user_status_idx` ON `orders` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`maker_user_id` integer NOT NULL,
	`taker_user_id` integer NOT NULL,
	`buyer_user_id` integer NOT NULL,
	`seller_user_id` integer NOT NULL,
	`price` real NOT NULL,
	`base_amount` real NOT NULL,
	`quote_amount` real NOT NULL,
	`status` text DEFAULT 'MATCHED' NOT NULL,
	`payment_ref` text,
	`paid_at` integer,
	`released_at` integer,
	`completed_at` integer,
	`cancel_reason` text,
	`idempotency_key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`maker_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`taker_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trades_idempotency_key_unique` ON `trades` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `trades_order_idx` ON `trades` (`order_id`);--> statement-breakpoint
CREATE INDEX `trades_buyer_status_idx` ON `trades` (`buyer_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `trades_seller_status_idx` ON `trades` (`seller_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`asset_id` integer NOT NULL,
	`available_balance` real DEFAULT 0 NOT NULL,
	`locked_balance` real DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallets_user_asset_idx` ON `wallets` (`user_id`,`asset_id`);