import type { EntryDepth } from "./types.js";

export type DealerSoft17 = "stand" | "hit";
export type BlackjackPayout = "3:2" | "6:5" | "2:1";
export type SurrenderRule = "none" | "late" | "early";

export interface BlackjackRules {
  decks: 1 | 2 | 4 | 6 | 8;
  seats: 5 | 6 | 7;
  entryDepth: EntryDepth;
  dealerSoft17: DealerSoft17;
  blackjackPayout: BlackjackPayout;
  peek: boolean;
  doubleAfterSplit: boolean;
  maxSplits: 1 | 2 | 3;
  splitAcesOneCard: boolean;
  resplitAces: boolean;
  blackjackAfterSplit: boolean;
  surrender: SurrenderRule;
  penetration: number;
  roundHoldMs: number;
  streakThreshold: number;
  sideBets: boolean;
  trainingOverlay: boolean;
  handsPerPlayer: 1 | 2;
  doubleForLess: boolean;
  insuranceTimerSec: number;
  autoHitLow: boolean;
  perfectPairsPayout: [number, number, number];
  twentyOnePlusThreePayout: [number, number, number, number, number];
}

export const DEFAULT_BLACKJACK_RULES: BlackjackRules = {
  decks: 6,
  seats: 7,
  entryDepth: "outcomes",
  dealerSoft17: "stand",
  blackjackPayout: "3:2",
  peek: true,
  doubleAfterSplit: true,
  maxSplits: 3,
  splitAcesOneCard: true,
  resplitAces: false,
  blackjackAfterSplit: false,
  surrender: "late",
  penetration: 0.75,
  roundHoldMs: 6000,
  streakThreshold: 5,
  sideBets: false,
  trainingOverlay: false,
  handsPerPlayer: 1,
  doubleForLess: true,
  insuranceTimerSec: 10,
  autoHitLow: false,
  perfectPairsPayout: [25, 12, 6],
  twentyOnePlusThreePayout: [100, 40, 30, 10, 5],
};
