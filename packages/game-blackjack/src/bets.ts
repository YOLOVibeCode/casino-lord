import type { BetCatalogue, PlacedBet } from "@casino-lord/core";
import type { BlackjackBetId, BlackjackBetTarget } from "./bet-target.js";
import { canPlaceInsurance } from "./actions-enabled.js";
import { blackjackPayoutFraction } from "./engine.js";
import { DEFAULT_BLACKJACK_RULES, type BlackjackRules } from "./rules.js";
import type { BlackjackResult } from "./types.js";
import type { BlackjackState } from "./state.js";

export const blackjackBets: BetCatalogue<
  BlackjackRules,
  BlackjackResult,
  BlackjackState,
  BlackjackBetTarget
> = {
  groups: [
    {
      id: "main",
      label: "Main",
      bets: [
        {
          id: "main",
          label: "Bet",
          lifecycle: "round",
          targets: "custom",
          pays: () => ({ num: 1, den: 1 }),
          note: (rules) => `BJ ${rules.blackjackPayout}`,
        },
        {
          id: "double",
          label: "Double Down",
          lifecycle: "round",
          targets: "custom",
          pays: () => ({ num: 1, den: 1 }),
        },
        {
          id: "split",
          label: "Split",
          lifecycle: "round",
          targets: "custom",
          pays: () => ({ num: 1, den: 1 }),
        },
      ],
    },
    {
      id: "side",
      label: "Side",
      bets: [
        {
          id: "insurance",
          label: "Insurance",
          lifecycle: "round",
          targets: "custom",
          pays: () => ({ num: 2, den: 1 }),
          allowedWhen: (state) => canPlaceInsurance(state, DEFAULT_BLACKJACK_RULES),
        },
        {
          id: "even_money",
          label: "Even Money",
          lifecycle: "round",
          targets: "custom",
          pays: () => ({ num: 1, den: 1 }),
          allowedWhen: (state) => canPlaceInsurance(state, DEFAULT_BLACKJACK_RULES),
        },
        {
          id: "perfect_pairs",
          label: "Perfect Pairs",
          lifecycle: "round",
          targets: "custom",
          pays: (rules) => ({ num: rules.perfectPairsPayout[0]!, den: 1 }),
          allowedWhen: (_state, _me) => true,
          note: () => "25:1 / 12:1 / 6:1",
        },
        {
          id: "twenty_one_plus_three",
          label: "21+3",
          lifecycle: "round",
          targets: "custom",
          pays: (rules) => ({ num: rules.twentyOnePlusThreePayout[0]!, den: 1 }),
          allowedWhen: (_state, _me) => true,
          note: () => "100 / 40 / 30 / 10 / 5 :1",
        },
      ],
    },
  ],

  summary(bets: PlacedBet<BlackjackBetTarget>[], _state: BlackjackState) {
    const mainIds = new Set<BlackjackBetId>(["main", "double", "split"]);
    const main = bets.filter((b) => mainIds.has(b.type as BlackjackBetId));
    const side = bets.filter((b) => !mainIds.has(b.type as BlackjackBetId));
    const seatSet = new Set(main.map((b) => b.target?.seat).filter((s) => s !== undefined));

    return [
      {
        label: `MAIN ${main.reduce((a, b) => a + b.amount, 0)} (${seatSet.size})`,
        amount: main.reduce((a, b) => a + b.amount, 0),
        count: main.length,
      },
      {
        label: `SIDE ${side.reduce((a, b) => a + b.amount, 0)}`,
        amount: side.reduce((a, b) => a + b.amount, 0),
        count: side.length,
      },
    ];
  },
};

export function mainBlackjackPays(rules: BlackjackRules): { num: number; den: number } {
  return blackjackPayoutFraction(rules.blackjackPayout);
}
