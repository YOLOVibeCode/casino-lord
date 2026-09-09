import { createHash, randomBytes } from "node:crypto";

export function generateDealerToken(): string {
  return randomBytes(16).toString("hex");
}

export function generatePlayerToken(): string {
  return randomBytes(16).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyToken(token: string, hash: string): boolean {
  return hashToken(token) === hash;
}
