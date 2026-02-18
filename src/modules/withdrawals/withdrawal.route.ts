import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../../middlewares/auth.js";
import { createWithdrawalController, createWithdrawalSchema, listMyWithdrawalsController } from "./withdrawal.controller.js";

export const withdrawalRoute = new Hono();

withdrawalRoute.use("*", authMiddleware);
withdrawalRoute.post("/", zValidator("json", createWithdrawalSchema), createWithdrawalController);
withdrawalRoute.get("/me", listMyWithdrawalsController);
