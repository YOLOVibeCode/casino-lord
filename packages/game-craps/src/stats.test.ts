import { describe, expect, it } from "vitest";
import { crapsStats } from "./stats.js";
import { initialState } from "./state.js";
import { DEFAULT_CRAPS_RULES } from "./rules.js";

describe("crapsStats", () => {
  it("returns shooter and table stat rows", () => {
    const rows = crapsStats(initialState(), DEFAULT_CRAPS_RULES);
    expect(rows.some((r) => r.label === "Shooter rolls")).toBe(true);
    expect(rows.some((r) => r.label === "Distribution")).toBe(true);
  });
});
