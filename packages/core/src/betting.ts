import type { PlacedBet } from "./data-model.js";

export interface Settlement<T = unknown> {
  betId: string;
  outcome: "win" | "lose" | "push" | "stay" | "partial";
  returned: number;
  profit: number;
  note?: string;
  carry?: PlacedBet<T>;
}

export interface BetDef<Rules, State, Target = unknown> {
  id: string;
  label: string;
  lifecycle: "round" | "working";
  targets?: "none" | "number" | "custom";
  pays(
    rules: Rules,
    ctx?: { target?: Target; state?: State },
  ): { num: number; den: number } | "itemised";
  note?(rules: Rules): string | undefined;
  allowedWhen?(state: State, me: PlayerStateForBet): boolean | string;
  limits?(rules: Rules): { min?: number; max?: number; maxMultipleOf?: string };
}

/** Minimal player context for bet validation (SPEC.md §17). */
export interface PlayerStateForBet {
  id: string;
  bankroll: number;
}

export interface BetCatalogue<Rules, _Result, State, Target = unknown> {
  groups: {
    id: string;
    label: string;
    bets: BetDef<Rules, State, Target>[];
  }[];
  summary(
    bets: PlacedBet<Target>[],
    state: State,
  ): { label: string; amount: number; count: number }[];
}
