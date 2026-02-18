import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).default("./sqlite.db"),
  JWT_SECRET: z.string().min(12, "JWT_SECRET must be at least 12 chars"),
});

export const env = envSchema.parse(process.env);
