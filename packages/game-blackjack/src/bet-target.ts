export const BLACKJACK_BET_IDS = [
  "main",
  "double",
  "split",
  "insurance",
  "even_money",
  "perfect_pairs",
  "twenty_one_plus_three",
] as const;

export type BlackjackBetId = (typeof BLACKJACK_BET_IDS)[number];

export interface BlackjackBetTarget {
  seat: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  handIndex?: number;
}
