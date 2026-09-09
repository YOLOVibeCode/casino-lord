import { hmacSha256 } from "./crypto/hmac.js";
import type { Rng } from "./platform-types.js";

function counterBytes(counter: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, counter >>> 0, false);
  return buf;
}

function uniformFromHmac(digest: Uint8Array, n: number): number | null {
  if (n <= 0) {
    throw new Error("rng.next(n): n must be positive");
  }
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const value = ((digest[0]! << 24) | (digest[1]! << 16) | (digest[2]! << 8) | digest[3]!) >>> 0;
  if (value >= limit) {
    return null;
  }
  return value % n;
}

export interface SeededRng extends Rng {
  readonly draws: { from: number; to: number };
}

/**
 * Deterministic RNG from a series seed (SPEC.md §14.2).
 * HMAC-SHA256(seed, counter) with rejection sampling on the leading 4 bytes.
 */
export function createSeededRng(seed: Uint8Array): SeededRng {
  let counter = 0;
  let lastDraw: { from: number; to: number } = { from: 0, to: 0 };

  const rng: SeededRng = {
    get draws() {
      return lastDraw;
    },
    next(n: number): number {
      const from = counter;
      while (true) {
        const digest = hmacSha256(seed, counterBytes(counter));
        counter++;
        const sample = uniformFromHmac(digest, n);
        if (sample !== null) {
          lastDraw = { from, to: counter };
          return sample;
        }
      }
    },
  };

  return rng;
}
