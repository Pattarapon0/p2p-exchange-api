import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

const dbUrl = env.DATABASE_URL.startsWith("file:") ? env.DATABASE_URL : `file:${env.DATABASE_URL}`;

export const client = createClient({
  url: dbUrl,
});

export const db = drizzle(client, { schema });
