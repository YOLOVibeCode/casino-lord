import { describe, expect, it } from "vitest";
import { FRENCH_ROULETTE_RULES } from "./rules.js";
import { settleOne, makeBet } from "./test-helpers.js";
import { settleRoulette } from "./settle.js";
import { initialState } from "./state.js";
import type { ImprisonedMarker, RouletteBetTarget } from "./bet-target.js";

describe("French zero rules", () => {
  it("la partage returns half on zero", () => {
    const rules = { ...FRENCH_ROULETTE_RULES, zeroRule: "la_partage" as const };
    const s = settleOne("red", 100, 0, rules, { kind: "red" });
    expect(s.outcome).toBe("partial");
    expect(s.returned).toBe(50);
    expect(s.profit).toBe(-50);
    expect(s.note).toContain("la partage");
  });

  it("en prison holds bet then pushes on win", () => {
    const rules = { ...FRENCH_ROULETTE_RULES, zeroRule: "en_prison" as const };
    const imprisoned = settleOne("red", 100, 0, rules, { kind: "red" });
    expect(imprisoned.outcome).toBe("stay");
    expect(imprisoned.carry?.working).toBe(true);

    const carry = imprisoned.carry!;
    const before = initialState(rules);
    const [nextSpin] = settleRoulette({
      bets: [carry],
      result: { pocket: 1 },
      before,
      after: before,
      rules,
    });
    expect(nextSpin!.outcome).toBe("push");
  });

  it("en prison loses on second zero when doublePrison is false", () => {
    const rules = { ...FRENCH_ROULETTE_RULES, zeroRule: "en_prison" as const, doublePrison: false };
    const carryTarget = { kind: "red" as const, imprisoned: true } as RouletteBetTarget &
      ImprisonedMarker;
    const bet = makeBet("red", 100, carryTarget);
    const before = initialState(rules);
    const [s] = settleRoulette({
      bets: [{ ...bet, working: true }],
      result: { pocket: 0 },
      before,
      after: before,
      rules,
    });
    expect(s!.outcome).toBe("lose");
  });
});
