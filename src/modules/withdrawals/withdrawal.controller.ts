import { z } from "zod";
import { createWithdrawal, listMyWithdrawals } from "./withdrawal.service.js";

export const createWithdrawalSchema = z.object({
  assetCode: z.string().min(2).max(10),
  amount: z.coerce.number().positive(),
  fee: z.coerce.number().min(0).optional(),
  network: z.string().min(1).max(50),
  address: z.string().min(6).max(255),
  idempotencyKey: z.string().min(1).optional(),
  provider: z.string().max(50).optional(),
});

export async function createWithdrawalController(c: any) {
  const authUser = c.get("authUser");
  const body = c.req.valid("json");
  const item = await createWithdrawal(authUser.userId, body);
  return c.json({ item }, 201);
}

export async function listMyWithdrawalsController(c: any) {
  const authUser = c.get("authUser");
  const items = await listMyWithdrawals(authUser.userId);
  return c.json({ items });
}
