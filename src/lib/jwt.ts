import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type JwtPayload = {
  userId: number;
  email: string;
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: "1d",
  });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === "string" || !("userId" in decoded) || !("email" in decoded)) {
    throw new Error("Invalid JWT payload");
  }
  return {
    userId: Number(decoded.userId),
    email: String(decoded.email),
  };
}
