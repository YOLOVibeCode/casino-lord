export type Pocket = "0" | "00" | number;

export type Color = "red" | "black" | "green";

export type Sector = "voisins" | "tiers" | "orphelins" | "zero" | null;

export interface NumberInfo {
  pocket: Pocket;
  color: Color;
  parity: "odd" | "even" | null;
  range: "low" | "high" | null;
  dozen: 1 | 2 | 3 | null;
  column: 1 | 2 | 3 | null;
  sector: Sector;
  wheelIndex: number;
}

export interface RouletteResult {
  pocket: Pocket | null;
}

export interface RouletteLiveInput {
  pending: Pocket | null;
  spinning?: boolean | undefined;
}

export interface SpinRecord extends RouletteResult {
  info: NumberInfo | null;
}

export interface StreakValue<T> {
  value: T;
  length: number;
}

export interface RoulettePercentages {
  red: number;
  black: number;
  green: number;
  odd: number;
  even: number;
  low: number;
  high: number;
  dozen: [number, number, number];
  column: [number, number, number];
}
