import { describe, expect, it } from "vitest";
import { rebuildDerived, type SpinEntry } from "./state.js";
import { DEFAULT_ROULETTE_RULES } from "./rules.js";

function spin(pocket: number | "0"): SpinEntry {
  return { id: `s-${pocket}`, data: { pocket: pocket === "0" ? 0 : pocket } };
}

describe("percentage denominators", () => {
  it("excludes zeros from odd/even denominator by default", () => {
    const spins = [spin(1), spin(2), spin("0")];
    const derived = rebuildDerived(spins, null, DEFAULT_ROULETTE_RULES);
    expect(derived.percentages.green).toBe(33);
    expect(derived.percentages.odd).toBe(50);
    expect(derived.percentages.even).toBe(50);
  });

  it("includes zero in denominator when zeroInDenominator is true", () => {
    const rules = { ...DEFAULT_ROULETTE_RULES, zeroInDenominator: true };
    const spins = [spin(1), spin(2), spin("0")];
    const derived = rebuildDerived(spins, null, rules);
    expect(derived.percentages.odd).toBe(33);
    expect(derived.percentages.even).toBe(33);
  });
});
