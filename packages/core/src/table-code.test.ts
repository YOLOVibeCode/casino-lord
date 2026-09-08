import { describe, expect, it } from "vitest";
import {
  TABLE_CODE_ALPHABET,
  TABLE_CODE_LENGTH,
  isValidTableCode,
  normalizeTableCode,
  tableCodeFrom,
} from "./table-code.js";

describe("table code alphabet", () => {
  it("has 32 unambiguous characters", () => {
    expect(TABLE_CODE_ALPHABET).toHaveLength(32);
    for (const banned of ["0", "O", "1", "I"]) {
      expect(TABLE_CODE_ALPHABET).not.toContain(banned);
    }
    expect(new Set(TABLE_CODE_ALPHABET).size).toBe(32);
  });
});

describe("normalizeTableCode", () => {
  it("uppercases and strips whitespace and hyphens", () => {
    expect(normalizeTableCode("k7x2-pq")).toBe("K7X2PQ");
    expect(normalizeTableCode(" k7x 2pq ")).toBe("K7X2PQ");
  });
});

describe("isValidTableCode", () => {
  it("accepts well-formed codes in any case", () => {
    expect(isValidTableCode("K7X2PQ")).toBe(true);
    expect(isValidTableCode("k7x2pq")).toBe(true);
  });

  it("rejects wrong length and banned characters", () => {
    expect(isValidTableCode("K7X2P")).toBe(false);
    expect(isValidTableCode("K7X2PQR")).toBe(false);
    expect(isValidTableCode("K7X2P0")).toBe(false);
    expect(isValidTableCode("K7X2PI")).toBe(false);
    expect(isValidTableCode("")).toBe(false);
  });
});

describe("tableCodeFrom", () => {
  it("maps injected integers onto the alphabet", () => {
    const seq = [0, 1, 2, 29, 30, 31];
    let i = 0;
    const code = tableCodeFrom(() => seq[i++]!);
    expect(code).toBe("ABC789");
    expect(code).toHaveLength(TABLE_CODE_LENGTH);
    expect(isValidTableCode(code)).toBe(true);
  });

  it("throws when the source returns an out-of-range value", () => {
    expect(() => tableCodeFrom(() => 32)).toThrow(RangeError);
    expect(() => tableCodeFrom(() => -1)).toThrow(RangeError);
  });
});
