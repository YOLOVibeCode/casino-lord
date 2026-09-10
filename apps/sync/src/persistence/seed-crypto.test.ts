import { describe, expect, it } from "vitest";
import {
  decryptSeed,
  encodeSeedForStorage,
  decodeSeedFromStorage,
  encryptSeed,
} from "./seed-crypto.js";

describe("seed-crypto", () => {
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) seed[i] = i;

  it("round-trips with SEED_KEY", () => {
    const blob = encryptSeed("test-key", seed);
    const restored = decryptSeed("test-key", blob);
    expect(restored).toEqual(seed);
    expect(blob.toString("hex")).not.toBe(Buffer.from(seed).toString("hex"));
  });

  it("stores plaintext when SEED_KEY is unset", () => {
    const blob = encodeSeedForStorage(undefined, seed);
    expect(decodeSeedFromStorage(undefined, blob)).toEqual(seed);
  });
});
