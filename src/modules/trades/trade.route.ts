import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../../middlewares/auth.js";
import {
  listMyTradesController,
  markPaidSchema,
  markTradePaidController,
  orderIdParamSchema,
  releaseTradeController,
  takeOrderController,
  takeOrderSchema,
  tradeIdParamSchema,
} from "./trade.controller.js";

export const tradeRoute = new Hono();

tradeRoute.use("*", authMiddleware);
tradeRoute.get("/me", listMyTradesController);
tradeRoute.post("/take/:orderId", zValidator("param", orderIdParamSchema), zValidator("json", takeOrderSchema), takeOrderController);
tradeRoute.post("/:id/mark-paid", zValidator("param", tradeIdParamSchema), zValidator("json", markPaidSchema), markTradePaidController);
tradeRoute.post("/:id/release", zValidator("param", tradeIdParamSchema), releaseTradeController);
