export type BurnRule = "none" | "first_card_value";

export interface BaccaratRules {
  decks: 6 | 8;
  bankerCommission: 0 | 0.05;
  noCommissionBanker6Payout: number;
  tiePayout: 8 | 9;
  pairPayout: number;
  suitRequired: boolean;
  dragonThreshold: number;
  predictionCells: boolean;
  tieMaxDivisor: number;
  burnRule: BurnRule;
}

export const DEFAULT_BACCARAT_RULES: BaccaratRules = {
  decks: 8,
  bankerCommission: 0.05,
  noCommissionBanker6Payout: 0.5,
  tiePayout: 8,
  pairPayout: 11,
  suitRequired: false,
  dragonThreshold: 6,
  predictionCells: false,
  tieMaxDivisor: 4,
  burnRule: "none",
};
