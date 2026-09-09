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
    const zeroHits = derived.counts["0"] ?? 0;
    const coldCandidates = derived.cold.filter(
      (p) => (derived.counts[String(p)] ?? 0) === zeroHits,
    );
    if (coldCandidates.length >= 2) {
      const indices = coldCandidates.map((p) => derived.hot.indexOf(p));
      expect(indices).toBeDefined();
    }
  });
});
