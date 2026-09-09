import { describe, expect, it } from "vitest";
import { FRENCH_ROULETTE_RULES } from "./rules.js";
import { settleOne } from "./test-helpers.js";

describe("call bet settlement", () => {
  it("itemises voisins win", () => {
    const s = settleOne("voisins", 900, 26, FRENCH_ROULETTE_RULES, { kind: "voisins" });
    expect(s.outcome).toBe("win");
    expect(s.note).toBeDefined();
    expect(s.profit).toBeGreaterThan(0);
  });

  it("itemises tiers loss", () => {
    const s = settleOne("tiers", 600, 1, FRENCH_ROULETTE_RULES, { kind: "tiers" });
    expect(s.outcome).toBe("lose");
  });

  it("itemises neighbours on anchor pocket", () => {
    const s = settleOne("neighbours", 500, 26, FRENCH_ROULETTE_RULES, {
      kind: "neighbours",
      pocket: 26,
    });
    expect(s.outcome).toBe("win");
    expect(s.note).toContain("straight 26");
  });
});
