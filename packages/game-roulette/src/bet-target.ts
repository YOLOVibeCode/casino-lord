import type { Pocket } from "./types.js";

export const ROULETTE_BET_IDS = [
  "straight",
  "split",
  "street",
  "corner",
  "six_line",
  "basket",
  "top_line",
  "dozen",
  "column",
  "red",
  "black",
  "odd",
  "even",
  "low",
  "high",
  "voisins",
  "tiers",
  "orphelins",
  "jeu_zero",
  "neighbours",
] as const;

export type RouletteBetId = (typeof ROULETTE_BET_IDS)[number];

export type RouletteBetTarget =
  | { kind: "straight"; pocket: Pocket }
  | { kind: "split"; pockets: [Pocket, Pocket] }
  | { kind: "street"; pockets: Pocket[] }
  | { kind: "corner"; pockets: Pocket[] }
  | { kind: "six_line"; pockets: Pocket[] }
  | { kind: "basket" }
  | { kind: "top_line" }
  | { kind: "dozen"; n: 1 | 2 | 3 }
  | { kind: "column"; n: 1 | 2 | 3 }
  | { kind: "red" }
  | { kind: "black" }
  | { kind: "odd" }
  | { kind: "even" }
  | { kind: "low" }
  | { kind: "high" }
  | { kind: "voisins" }
  | { kind: "tiers" }
  | { kind: "orphelins" }
  | { kind: "jeu_zero" }
  | { kind: "neighbours"; pocket: Pocket };

/** Marker stored on imprisoned even-money bets (PlacedBet has no imprisoned field). */
export interface ImprisonedMarker {
  imprisoned: true;
}
