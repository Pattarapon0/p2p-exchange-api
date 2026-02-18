import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { wallets } from "../../db/schema.js";

export const walletRepository = {
  listByUser(userId: number) {
    return db.query.wallets.findMany({
      where: eq(wallets.userId, userId),
      with: {
        asset: true,
      },
    });
  },
};
