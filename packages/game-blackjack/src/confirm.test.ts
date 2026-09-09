import { describe, expect, it } from "vitest";
import { blackjackConfirm } from "./confirm.js";
import { evaluateLiveInput } from "./round-state.js";
import { rebuildDerived, initialState } from "./state.js";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";
import type { Card } from "./types.js";

function c(rank: Card["rank"], suit: Card["suit"] = "S"): Card {
  return { rank, suit };
}

describe("confirm", () => {
  it("blocks on illegal dealer sequence", () => {
    const rules = { ...DEFAULT_BLACKJACK_RULES, entryDepth: "full" as const };
    const live = {
      dealer: [c("10"), c("7"), c("2")],
      seats: {
        1: [
          {
            cards: [c("10"), c("9")],
            doubled: false,
            fromSplit: false,
            surrendered: false,
            outcome: null,
          },
        ],
      },
    };
    const base = { rounds: [], liveInput: live };
    const state = { ...base, ...rebuildDerived(base, rules) };
    const confirm = blackjackConfirm(state, rules);
    expect(confirm?.enabled).toBe(false);
    expect(confirm?.badges?.length).toBeGreaterThan(0);
  });

  it("allows override with dealerError", () => {
    const rules = { ...DEFAULT_BLACKJACK_RULES, entryDepth: "full" as const };
    const live = {
      dealer: [c("10"), c("7"), c("2")],
      seats: {
        1: [
          {
            cards: [c("10"), c("9")],
            doubled: false,
            fromSplit: false,
            surrendered: false,
            outcome: null,
          },
        ],
      },
      recordDespiteDealerError: true,
    };
    const eval_ = evaluateLiveInput(live, rules);
    const base = { rounds: [], liveInput: live };
    const state = {
      ...base,
      ...rebuildDerived(base, rules),
      roundEvaluation: eval_,
    };
    const confirm = blackjackConfirm(state, rules);
    expect(confirm?.enabled).toBe(true);
    expect(confirm?.result?.dealerError).toBe(true);
  });
});
