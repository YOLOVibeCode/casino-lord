import { describe, expect, it } from "vitest";
import { reduce } from "./reducer.js";
import { initialState } from "./state.js";
import type { TableEvent } from "@casino-lord/core";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";

function ev(seq: number, body: Record<string, unknown> & { type: string }): TableEvent {
  return {
    seq,
    at: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
    ...body,
  } as TableEvent;
}

describe("reducer", () => {
  it("PLAYER_ACTION intent does not change state", () => {
    const state = initialState();
    const next = reduce(
      state,
      ev(1, { type: "PLAYER_ACTION", playerId: "p1", action: "hit", intent: true }),
      DEFAULT_BLACKJACK_RULES,
    );
    expect(next).toBe(state);
  });
});
