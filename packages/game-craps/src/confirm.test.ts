import { describe, expect, it } from "vitest";
import { crapsConfirm } from "./confirm.js";
import { initialState } from "./state.js";
import { DEFAULT_CRAPS_RULES } from "./rules.js";

describe("crapsConfirm", () => {
  it("labels point established", () => {
    const state = { ...initialState(), liveInput: { a: 4, b: 4 } };
    const confirm = crapsConfirm(state, DEFAULT_CRAPS_RULES);
    expect(confirm?.label).toContain("POINT ESTABLISHED");
  });

  it("labels seven out in point phase", () => {
    const state = {
      ...initialState(),
      phase: "point" as const,
      point: 8 as const,
      liveInput: { a: 4, b: 3 },
    };
    const confirm = crapsConfirm(state, DEFAULT_CRAPS_RULES);
    expect(confirm?.label).toContain("SEVEN OUT");
    expect(confirm?.color).toBe("#D7263D");
    expect(confirm?.autoSeries).toBe(true);
  });
});
