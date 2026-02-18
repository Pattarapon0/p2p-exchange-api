import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../../middlewares/auth.js";
import { getWalletTransactionsController, getWalletsController, txQuerySchema } from "./wallet.controller.js";

export const walletRoute = new Hono();

walletRoute.use("*", authMiddleware);
walletRoute.get("/", getWalletsController);
walletRoute.get("/transactions", zValidator("query", txQuerySchema), getWalletTransactionsController);
