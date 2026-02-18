import { z } from "zod";
import { getWalletTransactions, getWalletsByUser } from "./wallet.service.js";

export const txQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export async function getWalletsController(c: any) {
  const authUser = c.get("authUser");
  const data = await getWalletsByUser(authUser.userId);
  return c.json({ items: data });
}

export async function getWalletTransactionsController(c: any) {
  const authUser = c.get("authUser");
  const query = c.req.valid("query");
  const data = await getWalletTransactions(authUser.userId, query.limit ?? 100);
  return c.json({ items: data });
}
