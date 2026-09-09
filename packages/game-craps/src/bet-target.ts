import type { Point } from "./types.js";

export const CRAPS_BET_IDS = [
  "pass",
  "dont_pass",
  "come",
  "dont_come",
  "pass_odds",
  "dont_odds",
  "place",
  "buy",
  "lay",
  "field",
  "hard",
  "any_seven",
  "any_craps",
  "two",
  "twelve",
  "three",
  "eleven",
  "horn",
  "horn_high_2",
  "horn_high_3",
  "horn_high_11",
  "horn_high_12",
  "ce",
  "fire",
  "ats_small",
  "ats_tall",
  "ats_all",
] as const;

export type CrapsBetId = (typeof CRAPS_BET_IDS)[number];

export type CrapsBetTarget =
  | { kind: "point"; value: Point }
  | { kind: "attach"; line: "pass" | "come" | "dont_pass" | "dont_come" }
  | { kind: "parent"; betId: string };

export const POINTS: Point[] = [4, 5, 6, 8, 9, 10];

export function isPoint(n: number): n is Point {
  return n === 4 || n === 5 || n === 6 || n === 8 || n === 9 || n === 10;
}
