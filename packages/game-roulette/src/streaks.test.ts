import { describe, expect, it } from "vitest";
import { rebuildDerived, type SpinEntry } from "./state.js";
import { DEFAULT_ROULETTE_RULES } from "./rules.js";

function spin(id: string, pocket: number): SpinEntry {
  return { id, data: { pocket } };
}

describe("streak detection", () => {
  it("breaks colour streak on zero", () => {
    const spins = [spin("1", 1), spin("2", 3), spin("3", 0), spin("4", 5)];
    const derived = rebuildDerived(spins, null, DEFAULT_ROULETTE_RULES);
    expect(derived.streaks.color?.value).toBe("red");
    expect(derived.streaks.color?.length).toBe(1);
  });
});
