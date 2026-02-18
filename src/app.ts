import { Hono } from "hono";
import { ZodError } from "zod";
import { AppError } from "./lib/errors.js";
import { authRoute } from "./modules/auth/auth.route.js";
import { transactionRoute } from "./modules/ledger/transaction.route.js";
import { orderRoute } from "./modules/orders/order.route.js";
import { tradeRoute } from "./modules/trades/trade.route.js";
import { transferRoute } from "./modules/transfers/transfer.route.js";
import { walletRoute } from "./modules/wallets/wallet.route.js";
import { withdrawalRoute } from "./modules/withdrawals/withdrawal.route.js";

export const app = new Hono();

app.get("/", (c) => {
  return c.json({
    name: "p2p-exchange-api",
    status: "ok",
  });
});

app.route("/auth", authRoute);
app.route("/wallets", walletRoute);
app.route("/orders", orderRoute);
app.route("/trades", tradeRoute);
app.route("/transfers", transferRoute);
app.route("/withdrawals", withdrawalRoute);
app.route("/transactions", transactionRoute);

app.onError((error, c) => {
  if (error instanceof ZodError) {
    return c.json(
      {
        message: "Validation error",
        issues: error.issues,
      },
      400,
    );
  }

  if (error instanceof AppError) {
    return c.json(
      {
        message: error.message,
      },
      error.statusCode,
    );
  }

  return c.json(
    {
      message: "Internal server error",
    },
    500,
  );
});
