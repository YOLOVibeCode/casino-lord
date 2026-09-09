import type { BetCatalogue, PlacedBet } from "@casino-lord/core";
import type { BaccaratBetId } from "./bet-target.js";
import type { BaccaratRules } from "./rules.js";
import type { BaccaratResult } from "./types.js";
import type { BaccaratState } from "./state.js";

function commissionNote(rules: BaccaratRules): string | undefined {
  if (rules.bankerCommission === 0) {
    return "1:2 on 6";
  }
  const pct = Math.round(rules.bankerCommission * 100);
  return `${pct}% commission`;
}

export const baccaratBets: BetCatalogue<
  BaccaratRules,
  BaccaratResult,
  BaccaratState,
  BaccaratBetId
> = {
  groups: [
    {
      id: "main",
      label: "Main",
      bets: [
        {
          id: "player",
          label: "PLAYER",
          lifecycle: "round",
          pays: () => ({ num: 1, den: 1 }),
        },
        {
          id: "banker",
          label: "BANKER",
          lifecycle: "round",
          pays: (rules) => {
            if (rules.bankerCommission === 0) {
              return { num: 1, den: 1 };
            }
            return { num: 1, den: 1 };
          },
          note: commissionNote,
        },
        {
          id: "tie",
          label: "TIE",
          lifecycle: "round",
          pays: (rules) => ({ num: rules.tiePayout, den: 1 }),
          limits: (rules) => ({ maxMultipleOf: `tableMax/${rules.tieMaxDivisor}` }),
        },
      ],
    },
    {
      id: "side",
      label: "Side",
      bets: [
        {
          id: "player_pair",
          label: "P PAIR",
          lifecycle: "round",
          pays: (rules) => ({ num: rules.pairPayout, den: 1 }),
        },
        {
          id: "banker_pair",
          label: "B PAIR",
          lifecycle: "round",
          pays: (rules) => ({ num: rules.pairPayout, den: 1 }),
        },
      ],
    },
  ],

  summary(bets: PlacedBet<BaccaratBetId>[], _state: BaccaratState) {
    const sum = (type: BaccaratBetId) => {
      const matching = bets.filter((b) => b.type === type);
      return {
        amount: matching.reduce((a, b) => a + b.amount, 0),
        count: matching.length,
      };
    };

    const player = sum("player");
    const banker = sum("banker");
    const tie = sum("tie");
    const playerPair = sum("player_pair");
    const bankerPair = sum("banker_pair");
    const sideAmount = playerPair.amount + bankerPair.amount;
    const sideCount = playerPair.count + bankerPair.count;

    const rows = [
      { label: "PLAYER", amount: player.amount, count: player.count },
      { label: "BANKER", amount: banker.amount, count: banker.count },
      { label: "TIE", amount: tie.amount, count: tie.count },
    ];

    if (sideCount > 0) {
      rows.push({ label: "SIDE", amount: sideAmount, count: sideCount });
    }

    return rows;
  },
};
