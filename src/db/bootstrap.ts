import { and, eq } from "drizzle-orm";
import { db } from "./client.js";
import { assets, markets } from "./schema.js";

const DEFAULT_ASSETS = [
  { code: "THB", type: "FIAT", precision: 2 },
  { code: "USD", type: "FIAT", precision: 2 },
  { code: "BTC", type: "CRYPTO", precision: 8 },
  { code: "ETH", type: "CRYPTO", precision: 8 },
  { code: "XRP", type: "CRYPTO", precision: 6 },
  { code: "DOGE", type: "CRYPTO", precision: 8 },
] as const;

const DEFAULT_MARKETS = [
  ["BTC", "THB"],
  ["BTC", "USD"],
  ["ETH", "THB"],
  ["ETH", "USD"],
  ["XRP", "THB"],
  ["XRP", "USD"],
  ["DOGE", "THB"],
  ["DOGE", "USD"],
] as const;

export async function ensureReferenceData(): Promise<void> {
  for (const asset of DEFAULT_ASSETS) {
    await db.insert(assets).values(asset).onConflictDoNothing();
  }

  const assetRows = await db.select().from(assets);
  const assetMap = new Map(assetRows.map((item) => [item.code, item.id]));

  for (const [baseCode, quoteCode] of DEFAULT_MARKETS) {
    const baseId = assetMap.get(baseCode);
    const quoteId = assetMap.get(quoteCode);
    if (!baseId || !quoteId) continue;

    const existing = await db.query.markets.findFirst({
      where: and(eq(markets.baseAssetId, baseId), eq(markets.quoteAssetId, quoteId)),
    });

    if (!existing) {
      await db.insert(markets).values({
        baseAssetId: baseId,
        quoteAssetId: quoteId,
      });
    }
  }
}
