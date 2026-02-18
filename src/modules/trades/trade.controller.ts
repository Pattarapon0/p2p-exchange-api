import { z } from "zod";
import { listMyTrades, markTradePaid, releaseTrade, takeOrder } from "./trade.service.js";

export const takeOrderSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  idempotencyKey: z.string().min(1).optional(),
});

export const markPaidSchema = z.object({
  paymentRef: z.string().max(100).optional(),
});

export const orderIdParamSchema = z.object({
  orderId: z.coerce.number().int().positive(),
});

export const tradeIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function takeOrderController(c: any) {
  const authUser = c.get("authUser");
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const item = await takeOrder(authUser.userId, params.orderId, body);
  return c.json({ item }, 201);
}

export async function markTradePaidController(c: any) {
  const authUser = c.get("authUser");
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const item = await markTradePaid(authUser.userId, params.id, body.paymentRef);
  return c.json({ item });
}

export async function releaseTradeController(c: any) {
  const authUser = c.get("authUser");
  const params = c.req.valid("param");
  const item = await releaseTrade(authUser.userId, params.id);
  return c.json({ item });
}

export async function listMyTradesController(c: any) {
  const authUser = c.get("authUser");
  const items = await listMyTrades(authUser.userId);
  return c.json({ items });
}
