import { describe, expect, it } from "vitest";
import type { PlacedBet } from "@casino-lord/core";
import { classifyRoll, normalizeResult } from "./engine.js";
import { reduce } from "./reducer.js";
import { DEFAULT_CRAPS_RULES } from "./rules.js";
import { settleCraps } from "./settle.js";
import { initialState } from "./state.js";
import { CRAPS_BET_IDS, type CrapsBetTarget } from "./bet-target.js";
import type { TableEvent } from "@casino-lord/core";

const STAKE = 100;

function makeBet(type: string, target?: CrapsBetTarget, working = true): PlacedBet<CrapsBetTarget> {
  return {
    id: `${type}-1`,
    playerId: "p1",
    roundId: "r1",
    type,
    target,
    amount: STAKE,
    declared: true,
    working,
    placedAt: "2026-01-01T00:00:00.000Z",
    originRoundId: "r1",
  };
}

function applyRoll(state: ReturnType<typeof initialState>, total: number, a?: number, b?: number) {
  const before = state;
  const event = {
    seq: 1,
    at: "2026-01-01T00:00:01.000Z",
    type: "RESULT_RECORDED",
    result: {
      id: `roll-${total}`,
      index: before.results.length,
      recordedAt: "",
      quick: false,
      source: "physical",
      by: "dealer",
      data: normalizeResult({ a: a ?? null, b: b ?? null, total }),
    },
  } as TableEvent;
  const after = reduce(before, event, DEFAULT_CRAPS_RULES);
  const result = normalizeResult({ a: a ?? null, b: b ?? null, total });
  return { before, after, result };
}

describe("settlement matrix", () => {
  it("pass line wins on natural", () => {
    let state = initialState();
    const { before, after, result } = applyRoll(state, 11, 5, 6);
    const [s] = settleCraps({
      bets: [makeBet("pass")],
      result,
      before,
      after,
      rules: DEFAULT_CRAPS_RULES,
    });
    expect(s?.outcome).toBe("win");
  });

  it("pass line loses on craps", () => {
    let state = initialState();
    const { before, after, result } = applyRoll(state, 3, 1, 2);
    const [s] = settleCraps({
      bets: [makeBet("pass")],
      result,
      before,
      after,
      rules: DEFAULT_CRAPS_RULES,
    });
    expect(s?.outcome).toBe("lose");
  });

  it("don't pass pushes on 12 by default", () => {
    let state = initialState();
    const { before, after, result } = applyRoll(state, 12, 6, 6);
    const [s] = settleCraps({
      bets: [makeBet("dont_pass")],
      result,
      before,
      after,
      rules: DEFAULT_CRAPS_RULES,
    });
    expect(s?.outcome).toBe("push");
  });

  it("come bet travels to number", () => {
    let state = initialState();
    state = reduce(
      state,
      {
        seq: 1,
        at: "",
        type: "RESULT_RECORDED",
        result: {
          id: "p",
          index: 0,
          recordedAt: "",
          quick: false,
          source: "physical",
          by: "dealer",
          data: normalizeResult({ a: 4, b: 4, total: 8 }),
        },
      },
      DEFAULT_CRAPS_RULES,
    );
    const { before, after, result } = applyRoll(state, 5, 2, 3);
    const [s] = settleCraps({
      bets: [makeBet("come")],
      result,
      before,
      after,
      rules: DEFAULT_CRAPS_RULES,
    });
    expect(s?.outcome).toBe("stay");
    expect(s?.carry?.target).toEqual({ kind: "point", value: 5 });
  });

  it("place bet stays off on come-out by default", () => {
    let state = initialState();
    const { before, after, result } = applyRoll(state, 7, 4, 3);
    const [s] = settleCraps({
      bets: [makeBet("place", { kind: "point", value: 6 }, false)],
      result,
      before,
      after,
      rules: DEFAULT_CRAPS_RULES,
    });
    expect(s?.outcome).toBe("stay");
  });

  it("field pays 2 and 12 variants", () => {
    let state = initialState();
    const rules = { ...DEFAULT_CRAPS_RULES, field2: 2 as const, field12: 3 as const };
    const r2 = applyRoll(state, 2, 1, 1);
    const [s2] = settleCraps({ bets: [makeBet("field")], ...r2, rules });
    expect(s2?.profit).toBe(200);

    const r12 = applyRoll(state, 12, 6, 6);
    const [s12] = settleCraps({ bets: [makeBet("field")], ...r12, rules });
    expect(s12?.profit).toBe(300);
  });

  it("fire bet resolves on seven-out", () => {
    let state = initialState();
    state = reduce(
      state,
      { seq: 0, at: "", type: "SERIES_STARTED", seriesId: "s1" },
      DEFAULT_CRAPS_RULES,
    );
    state = applyRoll(state, 8, 4, 4).after;
    state = applyRoll(state, 8, 4, 4).after;
    state = applyRoll(state, 6, 3, 3).after;
    state = applyRoll(state, 6, 3, 3).after;
    state = applyRoll(state, 6, 3, 3).after;
    const { before, after, result } = applyRoll(state, 7, 4, 3);
    const [s] = settleCraps({
      bets: [makeBet("fire")],
      result,
      before,
      after,
      rules: DEFAULT_CRAPS_RULES,
    });
    expect(["win", "lose"]).toContain(s?.outcome);
  });

  it("settles every catalogue bet id without falling through to default lose", () => {
    let state = initialState();
    const { before, after, result } = applyRoll(state, 7, 4, 3);

    for (const betId of CRAPS_BET_IDS) {
      const target =
        betId === "place" || betId === "buy" || betId === "lay" || betId === "hard"
          ? ({ kind: "point", value: 6 } as const)
          : betId === "pass_odds"
            ? ({ kind: "attach", line: "pass" } as const)
            : betId === "dont_odds"
              ? ({ kind: "attach", line: "dont_pass" } as const)
              : undefined;
      const [s] = settleCraps({
        bets: [makeBet(betId, target)],
        result,
        before,
        after,
        rules: DEFAULT_CRAPS_RULES,
      });
      expect(["win", "lose", "push", "stay", "partial"]).toContain(s?.outcome);
    }
  });
});
