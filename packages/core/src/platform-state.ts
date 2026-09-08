import type { GameId, Participation } from "./types.js";
import type { BettingRound, PlacedBet, Player } from "./data-model.js";
import type { Settlement } from "./betting.js";
import type { TableSettings } from "./settings.js";

export interface PlatformState {
  code: string;
  game: GameId;
  participation: Participation;
  settings: TableSettings;
  players: Player[];
  bankrolls: Record<string, number>;
  rounds: BettingRound[];
  bets: PlacedBet[];
  settlements: Record<string, Settlement[]>;
  currentSeriesId: string | null;
}

export function initialPlatformState(): PlatformState {
  return {
    code: "",
    game: "baccarat",
    participation: { playerMode: "off", bank: "none", outcomeSource: "physical" },
    settings: {} as TableSettings,
    players: [],
    bankrolls: {},
    rounds: [],
    bets: [],
    settlements: {},
    currentSeriesId: null,
  };
}

export function getBankroll(state: PlatformState, playerId: string): number {
  return state.bankrolls[playerId] ?? 0;
}

export function openBetsForPlayer(state: PlatformState, playerId: string): PlacedBet[] {
  const openRoundIds = new Set(
    state.rounds.filter((r) => r.status === "open" || r.status === "closed").map((r) => r.id),
  );
  return state.bets.filter((b) => b.playerId === playerId && openRoundIds.has(b.roundId));
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(value, replacer);
}

function replacer(_key: string, val: unknown): unknown {
  if (val !== null && typeof val === "object" && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      sorted[k] = obj[k];
    }
    return sorted;
  }
  return val;
}
