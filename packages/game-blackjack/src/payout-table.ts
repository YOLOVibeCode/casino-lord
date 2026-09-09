import type { BlackjackRules } from "./rules.js";
import { blackjackPayoutFraction } from "./engine.js";

export interface PayoutRow {
  group: string;
  bet: string;
  pays: string;
  note?: string;
}

export interface CalculatorDef {
  groups: {
    label: string;
    bets: {
      id: string;
      label: string;
      pays(rules: BlackjackRules): { num: number; den: number } | ((bet: number) => number);
      note?(rules: BlackjackRules): string | undefined;
    }[];
  }[];
  contexts?: { id: string; label: string; options: string[] }[];
}

export function payoutTable(rules: BlackjackRules): CalculatorDef {
  const bj = blackjackPayoutFraction(rules.blackjackPayout);
  const groups: CalculatorDef["groups"] = [
    {
      label: "Main",
      bets: [
        { id: "main_win", label: "Win", pays: () => ({ num: 1, den: 1 }) },
        {
          id: "main_bj",
          label: "Blackjack",
          pays: () => bj,
          note: () => rules.blackjackPayout,
        },
        { id: "main_double_win", label: "Doubled win", pays: () => ({ num: 2, den: 1 }) },
        {
          id: "main_push",
          label: "Push",
          pays: () => ({ num: 0, den: 1 }),
          note: () => "returns stake",
        },
        {
          id: "main_surrender",
          label: "Surrender",
          pays: () => (amount: number) => Math.floor(amount / 2),
          note: () => "returns ½ stake",
        },
      ],
    },
    {
      label: "Side",
      bets: [
        { id: "insurance", label: "Insurance", pays: () => ({ num: 2, den: 1 }) },
        { id: "even_money", label: "Even money", pays: () => ({ num: 1, den: 1 }) },
      ],
    },
  ];

  if (rules.sideBets) {
    groups.push({
      label: "Side (optional)",
      bets: [
        {
          id: "perfect_pairs",
          label: "Perfect Pairs",
          pays: () => ({ num: rules.perfectPairsPayout[0]!, den: 1 }),
          note: () => "25:1 / 12:1 / 6:1",
        },
        {
          id: "twenty_one_plus_three",
          label: "21+3",
          pays: () => ({ num: rules.twentyOnePlusThreePayout[0]!, den: 1 }),
          note: () => "100 / 40 / 30 / 10 / 5 :1",
        },
      ],
    });
  }

  return {
    groups,
    contexts: [
      { id: "blackjackPayout", label: "Blackjack payout", options: ["3:2", "6:5", "2:1"] },
    ],
  };
}

export function payoutRows(rules: BlackjackRules): PayoutRow[] {
  const calc = payoutTable(rules);
  const rows: PayoutRow[] = [];
  for (const group of calc.groups) {
    for (const bet of group.bets) {
      const paysVal = bet.pays(rules);
      const paysStr = typeof paysVal === "function" ? "itemised" : `${paysVal.num}:${paysVal.den}`;
      const row: PayoutRow = {
        group: group.label,
        bet: bet.label,
        pays: paysStr,
      };
      const note = bet.note?.(rules);
      if (note !== undefined) row.note = note;
      rows.push(row);
    }
  }
  return rows;
}
