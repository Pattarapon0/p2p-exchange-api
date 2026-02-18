import { createMiddleware } from "hono/factory";
import type { AppBindings } from "../types/hono.js";
import { AppError } from "../lib/errors.js";
import { verifyToken } from "../lib/jwt.js";

export const authMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const authorization = c.req.header("Authorization");
  if (!authorization) {
    throw new AppError(401, "Missing Authorization header");
  }

  const [type, token] = authorization.split(" ");
  if (type !== "Bearer" || !token) {
    throw new AppError(401, "Invalid Authorization format");
  }

  try {
    const payload = verifyToken(token);
    c.set("authUser", payload);
    await next();
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
});
