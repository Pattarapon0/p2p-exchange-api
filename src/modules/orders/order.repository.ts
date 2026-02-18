import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { orders } from "../../db/schema.js";

export const orderRepository = {
  listOpen(limit = 50) {
    return db.query.orders.findMany({
      where: inArray(orders.status, ["OPEN", "PARTIALLY_FILLED"]),
      with: {
        user: true,
        market: {
          with: {
            baseAsset: true,
            quoteAsset: true,
          },
        },
      },
      orderBy: desc(orders.createdAt),
      limit,
    });
  },

  listByUser(userId: number, limit = 50) {
    return db.query.orders.findMany({
      where: eq(orders.userId, userId),
      with: {
        market: {
          with: {
            baseAsset: true,
            quoteAsset: true,
          },
        },
        trades: true,
      },
      orderBy: desc(orders.createdAt),
      limit,
    });
  },

  findByIdWithRelations(orderId: number) {
    return db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        user: true,
        market: {
          with: {
            baseAsset: true,
            quoteAsset: true,
          },
        },
        trades: true,
      },
    });
  },
};
