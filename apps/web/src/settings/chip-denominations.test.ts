import { describe, expect, it } from "vitest";
import { parseChipDenominations } from "./chip-denominations.js";

describe("parseChipDenominations", () => {
  it("parses comma-separated positive integers", () => {
    expect(parseChipDenominations("5, 25, 100, 500")).toEqual([5, 25, 100, 500]);
  });

  it("rejects empty input", () => {
    expect(parseChipDenominations("")).toBeNull();
    expect(parseChipDenominations("  ")).toBeNull();
  });

  it("rejects zero, negative, and non-integers", () => {
    expect(parseChipDenominations("0,5")).toBeNull();
    expect(parseChipDenominations("-1,5")).toBeNull();
    expect(parseChipDenominations("5.5,25")).toBeNull();
  });

  it("rejects trailing commas and non-numeric tokens", () => {
    expect(parseChipDenominations("5,")).toBeNull();
    expect(parseChipDenominations("5,abc")).toBeNull();
  });
});
