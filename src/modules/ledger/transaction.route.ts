import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../../middlewares/auth.js";
import { listTransactionsController, txQuerySchema } from "./transaction.controller.js";

export const transactionRoute = new Hono();

transactionRoute.use("*", authMiddleware);
transactionRoute.get("/", zValidator("query", txQuerySchema), listTransactionsController);
