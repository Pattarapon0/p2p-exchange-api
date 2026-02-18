import { z } from "zod";
import { createInternalTransfer, listMyInternalTransfers } from "./transfer.service.js";

export const createTransferSchema = z.object({
  toUserId: z.coerce.number().int().positive(),
  assetCode: z.string().min(2).max(10),
  amount: z.coerce.number().positive(),
  note: z.string().max(255).optional(),
  idempotencyKey: z.string().min(1).optional(),
});

export async function createInternalTransferController(c: any) {
  const authUser = c.get("authUser");
  const body = c.req.valid("json");
  const item = await createInternalTransfer(authUser.userId, body);
  return c.json({ item }, 201);
}

export async function listMyInternalTransfersController(c: any) {
  const authUser = c.get("authUser");
  const items = await listMyInternalTransfers(authUser.userId);
  return c.json({ items });
}
