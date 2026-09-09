import { describe, expect, it } from "vitest";
import { BACCARAT_BET_IDS } from "./bet-target.js";
import { initialState } from "./state.js";
import { settleBaccarat } from "./settle.js";
import type { BaccaratRules } from "./rules.js";
import type { BaccaratResult } from "./types.js";
import type { PlacedBet } from "@casino-lord/core";

const STAKE = 100;

function makeBet(
  type: (typeof BACCARAT_BET_IDS)[number],
): PlacedBet<(typeof BACCARAT_BET_IDS)[number]> {
  return {
    id: `bet-${type}`,
    playerId: "p1",
    roundId: "r1",
    type,
    amount: STAKE,
    declared: false,
    working: false,
    placedAt: "2026-01-01T00:00:00.000Z",
    originRoundId: "r1",
  };
}

function makeResult(
  overrides: Partial<BaccaratResult> & Pick<BaccaratResult, "outcome">,
): BaccaratResult {
  return {
    cards: null,
    playerTotal: overrides.outcome === "P" ? 7 : overrides.outcome === "B" ? 4 : 5,
    bankerTotal: overrides.outcome === "B" ? 8 : overrides.outcome === "P" ? 3 : 5,
    playerPair: false,
    bankerPair: false,
    natural: false,
    ...overrides,
  };
}

function settleOne(
  type: (typeof BACCARAT_BET_IDS)[number],
  result: BaccaratResult,
  rules: BaccaratRules,
) {
  const state = initialState(rules);
  return settleBaccarat({
    bets: [makeBet(type)],
    result,
    before: state,
    after: state,
    rules,
  })[0]!;
}

describe("settlement matrix", () => {
  const outcomes = ["P", "B", "T"] as const;
  const pairFlags = [
    { playerPair: false, bankerPair: false },
    { playerPair: true, bankerPair: false },
    { playerPair: false, bankerPair: true },
    { playerPair: true, bankerPair: true },
  ];
  const commissions = [0, 0.05] as const;
  const tiePayouts = [8, 9] as const;

  for (const outcome of outcomes) {
    for (const flags of pairFlags) {
      for (const commission of commissions) {
        for (const tiePayout of tiePayouts) {
          const rules: BaccaratRules = {
            decks: 8,
            bankerCommission: commission,
            noCommissionBanker6Payout: 0.5,
            tiePayout,
            pairPayout: 11,
            suitRequired: false,
            dragonThreshold: 6,
            predictionCells: false,
            tieMaxDivisor: 4,
            burnRule: "none",
          };

          it(`player on ${outcome} commission=${commission} tie=${tiePayout} pairs=${flags.playerPair}/${flags.bankerPair}`, () => {
            const result = makeResult({ outcome, ...flags });
            const s = settleOne("player", result, rules);
            if (outcome === "P") {
              expect(s.outcome).toBe("win");
              expect(s.profit).toBe(STAKE);
            } else if (outcome === "T") {
              expect(s.outcome).toBe("push");
              expect(s.profit).toBe(0);
            } else {
              expect(s.outcome).toBe("lose");
              expect(s.profit).toBe(-STAKE);
            }
          });

          it(`banker on ${outcome} commission=${commission} tie=${tiePayout} pairs=${flags.playerPair}/${flags.bankerPair}`, () => {
            const result = makeResult({ outcome, ...flags });
            const s = settleOne("banker", result, rules);
            if (outcome === "B") {
              expect(s.outcome).toBe("win");
              expect(s.profit).toBe(Math.floor(STAKE * (1 - commission)));
            } else if (outcome === "T") {
              expect(s.outcome).toBe("push");
            } else {
              expect(s.outcome).toBe("lose");
            }
          });

          it(`tie on ${outcome} commission=${commission} tie=${tiePayout}`, () => {
            const result = makeResult({ outcome, ...flags });
            const s = settleOne("tie", result, rules);
            if (outcome === "T") {
              expect(s.outcome).toBe("win");
              expect(s.profit).toBe(STAKE * tiePayout);
            } else {
              expect(s.outcome).toBe("lose");
            }
          });

          it(`player_pair on ${outcome} pp=${flags.playerPair}`, () => {
            const result = makeResult({ outcome, ...flags });
            const s = settleOne("player_pair", result, rules);
            if (flags.playerPair) {
              expect(s.outcome).toBe("win");
              expect(s.profit).toBe(STAKE * 11);
            } else {
              expect(s.outcome).toBe("lose");
            }
          });

          it(`banker_pair on ${outcome} bp=${flags.bankerPair}`, () => {
            const result = makeResult({ outcome, ...flags });
            const s = settleOne("banker_pair", result, rules);
            if (flags.bankerPair) {
              expect(s.outcome).toBe("win");
              expect(s.profit).toBe(STAKE * 11);
            } else {
              expect(s.outcome).toBe("lose");
            }
          });
        }
      }
    }
  }

  it("banker no-commission pays 1:2 on banker total 6", () => {
    const rules: BaccaratRules = {
      decks: 8,
      bankerCommission: 0,
      noCommissionBanker6Payout: 0.5,
      tiePayout: 8,
      pairPayout: 11,
      suitRequired: false,
      dragonThreshold: 6,
      predictionCells: false,
      tieMaxDivisor: 4,
      burnRule: "none",
    };
    const result = makeResult({ outcome: "B", bankerTotal: 6, playerTotal: 4 });
    const s = settleOne("banker", result, rules);
    expect(s.outcome).toBe("win");
    expect(s.profit).toBe(50);
    expect(s.returned).toBe(150);
  });
});
