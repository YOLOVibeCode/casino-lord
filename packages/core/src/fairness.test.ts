import { describe, expect, it } from "vitest";
import { commitFor, verifyCommit } from "./fairness.js";
import { hexToBytes } from "./crypto/sha256.js";

describe("commitFor", () => {
  it("round-trips with verifyCommit", () => {
    const seed = hexToBytes("010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20");
    const commit = commitFor(seed, "K7X2PQ", "series-1");
    expect(commit).toHaveLength(64);
    expect(verifyCommit(seed, "K7X2PQ", "series-1", commit)).toBe(true);
    expect(verifyCommit(seed, "K7X2PQ", "series-1", "deadbeef")).toBe(false);
  });

  it("changes when table code or series id changes", () => {
    const seed = hexToBytes("010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20");
    const a = commitFor(seed, "K7X2PQ", "series-1");
    const b = commitFor(seed, "K7X2PR", "series-1");
    const c = commitFor(seed, "K7X2PQ", "series-2");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
