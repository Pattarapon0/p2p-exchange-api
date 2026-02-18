import { z } from "zod";
import { cancelOrder, createOrder, listMarkets, listMyOrders, listOpenOrders } from "./order.service.js";

export const createOrderSchema = z.object({
  side: z.enum(["BUY", "SELL"]),
  marketId: z.coerce.number().int().positive(),
  price: z.coerce.number().positive(),
  amount: z.coerce.number().positive(),
  minQuoteAmount: z.coerce.number().min(0).optional(),
  maxQuoteAmount: z.coerce.number().positive().optional(),
  expiresAt: z.coerce.number().int().optional().nullable(),
  idempotencyKey: z.string().min(1).optional(),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function listMarketsController(c: any) {
  const items = await listMarkets();
  return c.json({ items });
}

export async function createOrderController(c: any) {
  const authUser = c.get("authUser");
  const body = c.req.valid("json");
  const item = await createOrder(authUser.userId, body);
  return c.json({ item }, 201);
}

export async function listOrdersController(c: any) {
  const items = await listOpenOrders();
  return c.json({ items });
}

export async function listMyOrdersController(c: any) {
  const authUser = c.get("authUser");
  const items = await listMyOrders(authUser.userId);
  return c.json({ items });
}

export async function cancelOrderController(c: any) {
  const authUser = c.get("authUser");
  const params = c.req.valid("param");
  const item = await cancelOrder(authUser.userId, params.id);
  return c.json({ item });
}
