import { describe, expect, it } from "vitest";
import { reduce } from "./reducer.js";
import { initialState } from "./state.js";
import { DEFAULT_ROULETTE_RULES } from "./rules.js";
import type { TableEvent } from "@casino-lord/core";

function ev(seq: number, body: Record<string, unknown> & { type: string }): TableEvent {
  return {
    seq,
    at: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
    ...body,
  } as TableEvent;
}

describe("reducer", () => {
  it("recomputes from edit point on RESULT_EDITED", () => {
    let state = initialState(DEFAULT_ROULETTE_RULES);
    state = reduce(
      state,
      ev(1, {
        type: "RESULT_RECORDED",
        result: {
          id: "r1",
          index: 0,
          recordedAt: "2026-01-01T00:00:01.000Z",
          quick: false,
          source: "physical",
          by: "dealer",
          data: { pocket: 1 },
        },
      }),
      DEFAULT_ROULETTE_RULES,
    );
    state = reduce(
      state,
      ev(2, {
        type: "RESULT_EDITED",
        result: {
          id: "r1",
          index: 0,
          recordedAt: "2026-01-01T00:00:01.000Z",
          quick: false,
          source: "physical",
          by: "dealer",
          data: { pocket: 0 },
        },
      }),
      DEFAULT_ROULETTE_RULES,
    );
    expect(state.lastSpin?.pocket).toBe(0);
    expect(state.percentages.green).toBe(100);
  });

  it("handles void spins", () => {
    let state = initialState(DEFAULT_ROULETTE_RULES);
    state = reduce(
      state,
      ev(1, {
        type: "RESULT_RECORDED",
        result: {
          id: "r1",
          index: 0,
          recordedAt: "2026-01-01T00:00:01.000Z",
          quick: true,
          source: "physical",
          by: "dealer",
          data: { pocket: null },
        },
      }),
      DEFAULT_ROULETTE_RULES,
    );
    expect(state.history[0]?.info).toBeNull();
    expect(state.percentages.red).toBe(0);
  });
});
