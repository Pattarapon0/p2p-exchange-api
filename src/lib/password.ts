import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export async function comparePassword(password: string, hashed: string): Promise<boolean> {
  const [salt, storedHash] = hashed.split(":");
  if (!salt || !storedHash) return false;

  const hashBuffer = Buffer.from(storedHash, "hex");
  const candidateBuffer = scryptSync(password, salt, hashBuffer.length);

  if (hashBuffer.length !== candidateBuffer.length) return false;
  return timingSafeEqual(hashBuffer, candidateBuffer);
}
