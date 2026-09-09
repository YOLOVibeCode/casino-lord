import { describe, expect, it } from "vitest";
import type { TableEvent } from "@casino-lord/core";
import { reduce } from "./reducer.js";
import { DEFAULT_CRAPS_RULES } from "./rules.js";
import { initialState } from "./state.js";

function ev(seq: number, body: Record<string, unknown> & { type: string }): TableEvent {
  return {
    seq,
    at: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
    ...body,
  } as TableEvent;
}

function roll(id: string, index: number, total: number, a?: number, b?: number) {
  return ev(index + 1, {
    type: "RESULT_RECORDED",
    result: {
      id,
      index,
      recordedAt: `2026-01-01T00:00:${String(index).padStart(2, "0")}.000Z`,
      quick: a === undefined,
      source: "physical",
      by: "dealer",
      data: { a: a ?? null, b: b ?? null, total, hard: null },
    },
  });
}

describe("Fire Bet progression", () => {
  it("counts distinct points without double-count and resets on seven-out", () => {
    let state = initialState();
    state = reduce(state, ev(1, { type: "SERIES_STARTED", seriesId: "s1" }), DEFAULT_CRAPS_RULES);
    state = reduce(state, roll("r1", 0, 8, 4, 4), DEFAULT_CRAPS_RULES);
    state = reduce(state, roll("r2", 1, 8, 4, 4), DEFAULT_CRAPS_RULES);
    expect(state.shooter.distinctPointsMade).toEqual([8]);
    expect(state.shooter.pointsMade).toBe(1);

    state = reduce(state, roll("r3", 2, 6, 3, 3), DEFAULT_CRAPS_RULES);
    state = reduce(state, roll("r4", 3, 6, 3, 3), DEFAULT_CRAPS_RULES);
    expect(state.shooter.distinctPointsMade).toEqual([6, 8]);

    state = reduce(state, roll("r5", 4, 6, 3, 3), DEFAULT_CRAPS_RULES);
    state = reduce(state, roll("r6", 5, 7, 4, 3), DEFAULT_CRAPS_RULES);
    expect(state.lastRoll?.info.decision).toBe("seven_out");

    state = reduce(
      state,
      ev(7, { type: "SERIES_STARTED", seriesId: "s2", auto: true }),
      DEFAULT_CRAPS_RULES,
    );
    expect(state.shooter.distinctPointsMade).toEqual([]);
    expect(state.shooter.rollCount).toBe(0);
  });
});

describe("All/Tall/Small", () => {
  const rules = { ...DEFAULT_CRAPS_RULES, trackAllTallSmall: true };

  it("tracks completion and resets on new shooter", () => {
    let state = initialState();
    state = reduce(state, ev(1, { type: "SERIES_STARTED", seriesId: "s1" }), rules);
    for (const [i, total] of [2, 3, 4, 5, 6].entries()) {
      state = reduce(state, roll(`s${i}`, i, total), rules);
    }
    expect(state.shooter.ats.small).toEqual([2, 3, 4, 5, 6]);

    state = reduce(state, roll("r5", 5, 7, 4, 3), rules);
    state = reduce(state, ev(7, { type: "SERIES_STARTED", seriesId: "s2", auto: true }), rules);
    expect(state.shooter.ats.small).toEqual([]);
  });
});

describe("seven-out auto-series semantics", () => {
  it("rebuilds correctly when mid-hand roll edited to seven-out", () => {
    let state = initialState();
    state = reduce(state, ev(1, { type: "SERIES_STARTED", seriesId: "s1" }), DEFAULT_CRAPS_RULES);
    state = reduce(state, roll("r1", 0, 8, 4, 4), DEFAULT_CRAPS_RULES);
    state = reduce(state, roll("r2", 1, 5, 2, 3), DEFAULT_CRAPS_RULES);

    state = reduce(
      state,
      ev(3, {
        type: "RESULT_EDITED",
        result: {
          id: "r2",
          index: 1,
          recordedAt: "",
          quick: false,
          source: "physical",
          by: "dealer",
          data: { a: 4, b: 3, total: 7, hard: null },
        },
      }),
      DEFAULT_CRAPS_RULES,
    );
    expect(state.lastRoll?.info.decision).toBe("seven_out");
    expect(state.phase).toBe("come_out");
  });
});
