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

function record(id: string, index: number, pocket: number): TableEvent {
  return ev(index + 1, {
    type: "RESULT_RECORDED",
    result: {
      id,
      index,
      recordedAt: `2026-01-01T00:00:${String(index).padStart(2, "0")}.000Z`,
      quick: false,
      source: "physical",
      by: "dealer",
      data: { pocket },
    },
  });
}

describe("repeat detection", () => {
  it("tracks consecutive identical numbers for 1 1 1", () => {
    let state = initialState(DEFAULT_ROULETTE_RULES);
    state = reduce(state, record("a", 0, 1), DEFAULT_ROULETTE_RULES);
    expect(state.repeats).toBe(0);
    state = reduce(state, record("b", 1, 1), DEFAULT_ROULETTE_RULES);
    expect(state.repeats).toBe(1);
    state = reduce(state, record("c", 2, 1), DEFAULT_ROULETTE_RULES);
    expect(state.repeats).toBe(2);
  });
});
