import { z } from "zod";
import { listTransactionsByUser } from "./ledger.service.js";

export const txQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export async function listTransactionsController(c: any) {
  const authUser = c.get("authUser");
  const query = c.req.valid("query");
  const items = await listTransactionsByUser(authUser.userId, query.limit ?? 100);
  return c.json({ items });
}
