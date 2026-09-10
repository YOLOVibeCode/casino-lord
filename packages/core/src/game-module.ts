import type { ZodSchema } from "zod";
import type { Component } from "preact";
import type { BetCatalogue } from "./betting.js";
import type { Settlement } from "./betting.js";
import type { PlacedBet, Series } from "./data-model.js";
import type { BettingRound } from "./data-model.js";
import type { TableEvent } from "./events.js";
import type { GameId } from "./types.js";
import type {
  ActionDef,
  BetsView,
  Emit,
  LayoutPreset,
  PlayerState,
  Rng,
  StatRow,
  TableMeta,
  VirtualTrigger,
} from "./platform-types.js";
import type { AnimationEventDef, AnimationTrigger } from "./animation.js";

export interface ConfirmState<Result> {
  label: string;
  color?: string;
  badges?: string[];
  enabled: boolean;
  result: Result | null;
  autoSeries?: boolean;
}

export interface GameModule<Rules, Result, LiveInput, State, BetTarget = unknown, Action = never> {
  id: GameId;
  name: string;
  seriesLabel: string;
  resultLabel: string;

  defaultRules: Rules;
  rulesSchema: ZodSchema<Rules>;
  resultSchema: ZodSchema<Result>;
  liveInputSchema: ZodSchema<LiveInput>;
  betTargetSchema: ZodSchema<BetTarget>;
  actionSchema?: ZodSchema<Action>;

  initialState(rules: Rules): State;
  reduce(state: State, event: TableEvent, rules: Rules): State;
  confirm(state: State, rules: Rules): ConfirmState<Result> | null;

  DealerView: Component<{
    state: State;
    rules: Rules;
    table: TableMeta;
    emit: Emit;
    record: (result: Result, opts: { quick: boolean }) => void;
  }>;
  DisplayView: Component<{
    state: State;
    rules: Rules;
    table: TableMeta;
    bets: BetsView;
    layout: LayoutPreset;
  }>;
  PlayerView: Component<{
    state: State;
    rules: Rules;
    me: PlayerState;
    round: BettingRound;
    place: (bet: Omit<PlacedBet<BetTarget>, "id" | "placedAt">) => void;
    remove: (betId: string) => void;
    act: (action: Action) => void;
  }>;
  ResultDetailView: Component<{ result: Result; rules: Rules }>;
  RulesSettingsView: Component<{ rules: Rules; onChange: (patch: Partial<Rules>) => void }>;

  bets: BetCatalogue<Rules, Result, State, BetTarget>;
  settle(input: {
    bets: PlacedBet<BetTarget>[];
    result: Result;
    before: State;
    after: State;
    rules: Rules;
  }): Settlement<BetTarget>[];

  playerActions?: ActionDef<Action>[];
  turn?(state: State): { playerId: string | null; prompt: string; deadlineMs?: number } | null;
  seats?: { max: number; assign: "dealer" | "player" | "auto" };

  virtual?: {
    kind: "dice" | "shoe" | "wheel";
    shoe?: { decks(rules: Rules): number; penetration(rules: Rules): number };
    step(input: {
      state: State;
      rules: Rules;
      rng: Rng;
      trigger: VirtualTrigger;
      action?: { playerId: string; action: Action };
      session?: unknown;
      seriesId?: string;
    }): {
      events: Omit<TableEvent, "seq" | "at">[];
      awaiting: "none" | "action" | "trigger";
      session?: unknown;
    };
  };

  animationEvents: AnimationEventDef[];
  deriveAnimations(prev: State, next: State, event: TableEvent): AnimationTrigger[];
  stats(state: State, rules: Rules): StatRow[];
  layouts: LayoutPreset[];

  exportSeries(series: Series<Result>, rules: Rules): string;
  importSeries(
    text: string,
    rules: Rules,
  ): { results: Result[]; warnings: string[] } | { error: string };

  /** Player-facing one-line result summary (SPEC.md §6, §11.1). */
  describeResult?(result: Result, rules: Rules): string;
}
