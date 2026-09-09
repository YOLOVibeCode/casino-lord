import type { GameId, Participation } from "./types.js";
import type { BettingRound, PlacedBet, Player } from "./data-model.js";
import type { TableEvent } from "./events.js";

/** Injected randomness for virtual outcomes (SPEC.md §14.2). */
export interface Rng {
  next(n: number): number;
  /** Draw counter range consumed by the last `next` call (seeded RNG only). */
  readonly draws?: { from: number; to: number };
}

export interface TableMeta {
  code: string;
  game: GameId;
  seriesNumber: number;
  resultIndex: number;
  participation: Participation;
  playerCount: number;
}

export type Emit = (event: Omit<TableEvent, "seq" | "at">) => void;

export interface BetsView {
  round: BettingRound | null;
  summaries: { label: string; amount: number; count: number }[];
  openBets: PlacedBet[];
}

export interface PlayerState {
  player: Player;
  bankroll: number;
  openBets: PlacedBet[];
}

export interface ActionDef<Action> {
  id: string;
  label: string;
  enabled?(state: unknown, me: PlayerState): boolean;
  action: Action;
}

export type VirtualTrigger = "deal" | "spin" | "roll";

export interface LayoutPreset {
  id: string;
  label: string;
  aspect?: string;
}

export interface StatRow {
  label: string;
  value: string | number;
}
