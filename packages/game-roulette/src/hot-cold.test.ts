import { describe, expect, it } from "vitest";
import { rebuildDerived, type SpinEntry } from "./state.js";
import { DEFAULT_ROULETTE_RULES } from "./rules.js";

function spin(id: string, pocket: number): SpinEntry {
  return { id, data: { pocket } };
}

describe("hot/cold ordering", () => {
  it("breaks ties by wheel index", () => {
    const spins = [spin("1", 32), spin("2", 15), spin("3", 32)];
    const derived = rebuildDerived(spins, null, DEFAULT_ROULETTE_RULES);
    expect(derived.hot[0]).toBe(32);
    expect(derived.counts["15"]).toBe(1);
    expect(derived.hot[1]).toBe(15);
    expect(derived.hot[2]).toBe(0);
  });

  it("orders zero-hit pockets by wheel index for hot/cold ties", () => {
    const derived = rebuildDerived([], null, DEFAULT_ROULETTE_RULES);
    expect(derived.hot.slice(0, 3)).toEqual([0, 32, 15]);
    expect(derived.cold.slice(0, 3)).toEqual([26, 3, 35]);
  });
});
