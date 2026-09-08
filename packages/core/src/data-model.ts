import type { GameId } from "./types.js";
import type { TableSettings } from "./settings.js";

export interface Table<R = unknown> {
  code: string;
  game: GameId;
  createdAt: string;
  participation: TableSettings["participation"];
  series: Series<R>[];
  players: Player[];
  settings: TableSettings;
  version: number;
  ended?: string;
}

export interface Series<R = unknown> {
  id: string;
  number: number;
  startedAt: string;
  label?: string;
  commit?: string;
  seed?: string;
  results: ResultEnvelope<R>[];
  rounds: BettingRound[];
}

export interface ResultEnvelope<R = unknown> {
  id: string;
  index: number;
  recordedAt: string;
  quick: boolean;
  source: "physical" | "virtual";
  by: "dealer" | "system";
  rng?: { from: number; to: number };
  roundId?: string;
  data: R;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  seat?: number;
  status: "pending" | "active" | "away" | "removed";
  joinedAt: string;
}

export interface BettingRound {
  id: string;
  status: "open" | "closed" | "settled";
  openedAt: string;
  closedAt?: string;
  resultId?: string;
}

export interface PlacedBet<T = unknown> {
  id: string;
  playerId: string;
  roundId: string;
  type: string;
  target?: T;
  amount: number;
  declared: boolean;
  working: boolean;
  placedAt: string;
  originRoundId: string;
}
