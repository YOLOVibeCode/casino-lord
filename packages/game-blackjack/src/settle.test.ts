import { describe, expect, it } from "vitest";
import { settleBlackjack } from "./settle.js";
import { initialState } from "./state.js";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";
import type { PlacedBet } from "@casino-lord/core";
import type { BlackjackBetTarget } from "./bet-target.js";
import type { BlackjackResult } from "./types.js";

const STAKE = 100;

function makeBet(
  id: string,
  type: import("./bet-target.js").BlackjackBetId,
  amount: number,
  seat: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 1,
): PlacedBet<BlackjackBetTarget> {
  return {
    id,
    type,
    amount,
    target: { seat },
    playerId: "p1",
    placedAt: "2026-01-01T00:00:00.000Z",
    roundId: "r1",
  };
}

function result(
  partial: Partial<BlackjackResult> & Pick<BlackjackResult, "seats">,
): BlackjackResult {
  return {
    dealer: { cards: [], total: 20, bust: false, blackjack: false },
    depth: "outcomes",
    dealerError: false,
    ...partial,
  };
}

describe("settlement", () => {
  const state = initialState();
  const rules = DEFAULT_BLACKJACK_RULES;

  it("main win pays 1:1", () => {
    const s = settleBlackjack({
      bets: [makeBet("b1", "main", STAKE)],
      result: result({
        seats: {
          1: [{ cards: [], doubled: false, fromSplit: false, surrendered: false, outcome: "win" }],
        },
      }),
      before: state,
      after: state,
      rules,
    });
    expect(s[0]!.profit).toBe(STAKE);
  });

  it("blackjack 3:2 vs 6:5 rounding", () => {
    for (const payout of ["3:2", "6:5"] as const) {
      const r = { ...rules, blackjackPayout: payout };
      const s = settleBlackjack({
        bets: [makeBet("b1", "main", STAKE)],
        result: result({
          seats: {
            1: [
              {
                cards: [],
                doubled: false,
                fromSplit: false,
                surrendered: false,
                outcome: "blackjack",
              },
            ],
          },
        }),
        before: state,
        after: state,
        rules: r,
      });
      const expected = payout === "3:2" ? 150 : 120;
      expect(s[0]!.profit).toBe(expected);
    }
  });

  it("insurance wins on dealer BJ", () => {
    const s = settleBlackjack({
      bets: [makeBet("b1", "insurance", 50)],
      result: {
        dealer: { cards: [], total: 21, bust: false, blackjack: true },
        seats: {},
        depth: "outcomes",
        dealerError: false,
      },
      before: state,
      after: state,
      rules,
    });
    expect(s[0]!.profit).toBe(100);
  });

  it("even money on player BJ vs ace", () => {
    const s = settleBlackjack({
      bets: [makeBet("b1", "even_money", STAKE)],
      result: result({
        dealer: { cards: [{ rank: "A", suit: "S" }], total: 21, bust: false, blackjack: true },
        seats: {
          1: [
            {
              cards: [],
              doubled: false,
              fromSplit: false,
              surrendered: false,
              outcome: "blackjack",
            },
          ],
        },
      }),
      before: state,
      after: state,
      rules,
    });
    expect(s[0]!.profit).toBe(STAKE);
  });

  it("surrender returns half", () => {
    const s = settleBlackjack({
      bets: [makeBet("b1", "main", STAKE)],
      result: result({
        seats: {
          1: [
            {
              cards: [],
              doubled: false,
              fromSplit: false,
              surrendered: true,
              outcome: "surrender",
            },
          ],
        },
      }),
      before: state,
      after: state,
      rules,
    });
    expect(s[0]!.returned).toBe(50);
    expect(s[0]!.outcome).toBe("partial");
  });

  it("doubled win pays 2:1 on total stake", () => {
    const s = settleBlackjack({
      bets: [makeBet("m1", "main", STAKE), makeBet("d1", "double", STAKE)],
      result: result({
        seats: {
          1: [{ cards: [], doubled: true, fromSplit: false, surrendered: false, outcome: "win" }],
        },
      }),
      before: state,
      after: state,
      rules,
    });
    expect(s.find((x) => x.betId === "d1")!.profit).toBe(STAKE * 2);
  });
});
