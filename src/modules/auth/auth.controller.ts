import { z } from "zod";
import { login, register } from "./auth.service.js";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function registerController(c: any) {
  const body = c.req.valid("json");
  const result = await register(body);
  return c.json(result, 201);
}

export async function loginController(c: any) {
  const body = c.req.valid("json");
  const result = await login(body);
  return c.json(result);
}
