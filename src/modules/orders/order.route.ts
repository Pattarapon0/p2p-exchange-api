import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../../middlewares/auth.js";
import {
  cancelOrderController,
  createOrderSchema,
  createOrderController,
  idParamSchema,
  listMarketsController,
  listMyOrdersController,
  listOrdersController,
} from "./order.controller.js";

export const orderRoute = new Hono();

orderRoute.get("/markets", listMarketsController);
orderRoute.get("/", listOrdersController);

orderRoute.use("*", authMiddleware);
orderRoute.post("/", zValidator("json", createOrderSchema), createOrderController);
orderRoute.get("/me", listMyOrdersController);
orderRoute.post("/:id/cancel", zValidator("param", idParamSchema), cancelOrderController);
