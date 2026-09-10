import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function deriveKey(seedKey: string): Buffer {
  return scryptSync(seedKey, "casino-lord-seed-v1", KEY_LEN);
}

export function encryptSeed(seedKey: string, seed: Uint8Array): Buffer {
  const key = deriveKey(seedKey);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(seed), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function decryptSeed(seedKey: string, blob: Buffer): Uint8Array {
  const key = deriveKey(seedKey);
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(data), decipher.final()]));
}

export function encodeSeedForStorage(seedKey: string | undefined, seed: Uint8Array): Buffer {
  if (!seedKey) {
    return Buffer.from(seed);
  }
  return encryptSeed(seedKey, seed);
}

export function decodeSeedFromStorage(seedKey: string | undefined, blob: Buffer): Uint8Array {
  if (!seedKey) {
    return new Uint8Array(blob);
  }
  if (blob.length <= IV_LEN + TAG_LEN) {
    throw new Error("invalid encrypted seed blob");
  }
  return decryptSeed(seedKey, blob);
}
