import { describe, expect, it } from "vitest";
import type { Rng } from "@casino-lord/core";
import { virtualWheelStep } from "./virtual.js";
import { initialState } from "./state.js";
import { DEFAULT_ROULETTE_RULES } from "./rules.js";
import { wheelOrder } from "./wheel.js";

class SequenceRng implements Rng {
  private i = 0;
  constructor(private readonly draws: number[]) {}
  next(n: number): number {
    const v = this.draws[this.i] ?? 0;
    this.i++;
    return v % n;
  }
}

describe("virtual spin", () => {
  it("fixed draws yield identical pocket sequence on both wheel types", () => {
    const draws = [0, 5, 10];
    const euState = initialState(DEFAULT_ROULETTE_RULES);
    const euOrder = wheelOrder(DEFAULT_ROULETTE_RULES);
    const euPockets = draws.map((d) => {
      const step = virtualWheelStep(euState, DEFAULT_ROULETTE_RULES, new SequenceRng([d]));
      const recorded = step.events.find((e) => e.type === "RESULT_RECORDED");
      return (recorded as { result: { data: { pocket: unknown } } }).result.data.pocket;
    });
    expect(euPockets).toEqual(draws.map((d) => euOrder[d]));

    const usRules = { ...DEFAULT_ROULETTE_RULES, wheel: "american" as const };
    const usOrder = wheelOrder(usRules);
    const usPockets = draws.map((d) => {
      const step = virtualWheelStep(initialState(usRules), usRules, new SequenceRng([d]));
      const recorded = step.events.find((e) => e.type === "RESULT_RECORDED");
      return (recorded as { result: { data: { pocket: unknown } } }).result.data.pocket;
    });
    expect(usPockets).toEqual(draws.map((d) => usOrder[d]));
  });
});
