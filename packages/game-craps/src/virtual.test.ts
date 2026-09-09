import { describe, expect, it } from "vitest";
import type { Rng } from "@casino-lord/core";
import { crapsVirtualStep } from "./virtual.js";
import { initialState } from "./state.js";
import { DEFAULT_CRAPS_RULES } from "./rules.js";

function makeTestRng(values: number[]): Rng {
  let i = 0;
  return {
    next(n: number) {
      const v = values[i % values.length] ?? 0;
      i++;
      return v % n;
    },
  };
}

describe("virtual dice", () => {
  it("fixed seed produces identical face sequence with two draws per roll", () => {
    const rngValues = [0, 3, 2, 5, 0, 3];
    const rng1 = makeTestRng(rngValues);
    const rng2 = makeTestRng(rngValues);
    const state = initialState();

    const run1 = crapsVirtualStep({
      state,
      rules: DEFAULT_CRAPS_RULES,
      rng: rng1,
      trigger: "roll",
    });
    const run2 = crapsVirtualStep({
      state,
      rules: DEFAULT_CRAPS_RULES,
      rng: rng2,
      trigger: "roll",
    });

    expect(run1.events).toHaveLength(2);
    expect(run2.events).toHaveLength(2);

    const live1 = run1.events[0];
    const live2 = run2.events[0];
    expect(live1?.type).toBe("LIVE_INPUT");
    expect(live2?.type).toBe("LIVE_INPUT");
    if (live1?.type === "LIVE_INPUT" && live2?.type === "LIVE_INPUT") {
      expect(live1.payload).toEqual(live2.payload);
    }

    const result1 = run1.events[1];
    const result2 = run2.events[1];
    if (result1?.type === "RESULT_RECORDED" && result2?.type === "RESULT_RECORDED") {
      expect(result1.result.data).toEqual(result2.result.data);
      const data = result1.result.data as { a: number; b: number };
      expect(data.a).toBeGreaterThanOrEqual(1);
      expect(data.a).toBeLessThanOrEqual(6);
      expect(data.b).toBeGreaterThanOrEqual(1);
      expect(data.b).toBeLessThanOrEqual(6);
    }
  });
});
