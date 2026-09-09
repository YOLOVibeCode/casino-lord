import { describe, expect, it } from "vitest";
import { createSeededRng } from "./rng.js";
import { hexToBytes } from "./crypto/sha256.js";

describe("createSeededRng", () => {
  it("is deterministic for a fixed seed", () => {
    const seed = hexToBytes("010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20");
    const a = createSeededRng(seed);
    const b = createSeededRng(seed);
    const drawsA = Array.from({ length: 10 }, () => a.next(52));
    const drawsB = Array.from({ length: 10 }, () => b.next(52));
    expect(drawsA).toEqual(drawsB);
  });

  it("records draw counter ranges", () => {
    const seed = hexToBytes("010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20");
    const rng = createSeededRng(seed);
    expect(rng.draws).toEqual({ from: 0, to: 0 });
    rng.next(6);
    expect(rng.draws.from).toBe(0);
    expect(rng.draws.to).toBeGreaterThan(0);
    const from = rng.draws.to;
    rng.next(6);
    expect(rng.draws.from).toBe(from);
    expect(rng.draws.to).toBeGreaterThan(from);
  });

  it("rejection sampling stays within range for small n", () => {
    const seed = hexToBytes("010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20");
    const rng = createSeededRng(seed);
    for (let i = 0; i < 6000; i++) {
      const value = rng.next(6);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
    }
  });

  it("rejection sampling is roughly uniform for n=6", () => {
    const seed = hexToBytes("010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20");
    const rng = createSeededRng(seed);
    const counts = [0, 0, 0, 0, 0, 0];
    const trials = 6000;
    for (let i = 0; i < trials; i++) {
      counts[rng.next(6)]!++;
    }
    const expected = trials / 6;
    for (const count of counts) {
      expect(count).toBeGreaterThan(expected * 0.8);
      expect(count).toBeLessThan(expected * 1.2);
    }
  });
});
