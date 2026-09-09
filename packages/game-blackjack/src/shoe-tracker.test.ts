import { describe, expect, it } from "vitest";
import { initialState, rebuildDerived } from "./state.js";
import { reduce } from "./reducer.js";
import type { TableEvent } from "@casino-lord/core";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";
import type { Card } from "./types.js";

function c(rank: Card["rank"], suit: Card["suit"] = "S"): Card {
  return { rank, suit };
}

function ev(seq: number, body: Record<string, unknown> & { type: string }): TableEvent {
  return {
    seq,
    at: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
    ...body,
  } as TableEvent;
}

describe("penetration meter", () => {
  it("exact counts in full depth", () => {
    const rules = { ...DEFAULT_BLACKJACK_RULES, entryDepth: "full" as const };
    let state = initialState(rules);
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
          data: {
            dealer: { cards: [c("7"), c("K"), c("4")], total: 21, bust: false, blackjack: false },
            seats: {
              1: [
                {
                  cards: [c("9"), c("A")],
                  doubled: false,
                  fromSplit: false,
                  surrendered: false,
                  outcome: "lose",
                },
              ],
            },
            depth: "full",
            dealerError: false,
          },
        },
      }),
      rules,
    );
    expect(state.cardsSeen).toBe(5);
    expect(state.penetrationEstimated).toBe(false);
  });

  it("estimates in outcomes depth", () => {
    const rules = { ...DEFAULT_BLACKJACK_RULES, entryDepth: "outcomes" as const };
    let state = initialState(rules);
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
          data: {
            dealer: { cards: [c("7"), c("K")], total: 17, bust: false, blackjack: false },
            seats: {
              1: [
                {
                  cards: [],
                  doubled: false,
                  fromSplit: false,
                  surrendered: false,
                  outcome: "lose",
                },
              ],
              2: [
                {
                  cards: [],
                  doubled: false,
                  fromSplit: false,
                  surrendered: false,
                  outcome: "lose",
                },
              ],
            },
            depth: "outcomes",
            dealerError: false,
          },
        },
      }),
      rules,
    );
    expect(state.penetrationEstimated).toBe(true);
    expect(state.cardsSeen).toBeGreaterThan(2);
  });
});
