import { serve } from "@hono/node-server";
import { env } from "./config/env.js";
import { ensureReferenceData } from "./db/bootstrap.js";
import { app } from "./app.js";

await ensureReferenceData();

serve({
  fetch: app.fetch,
  port: env.PORT,
});
