import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../../middlewares/auth.js";
import { createInternalTransferController, createTransferSchema, listMyInternalTransfersController } from "./transfer.controller.js";

export const transferRoute = new Hono();

transferRoute.use("*", authMiddleware);
transferRoute.post("/internal", zValidator("json", createTransferSchema), createInternalTransferController);
transferRoute.get("/internal/me", listMyInternalTransfersController);
