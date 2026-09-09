import type { BettingRound, PlacedBet, Player } from "./data-model.js";
import type { GameModule } from "./game-module.js";
import type { BetsView } from "./platform-types.js";
import type { PlatformState } from "./platform-state.js";
import { getBankroll } from "./platform-state.js";

export function getCurrentRound(state: PlatformState): BettingRound | null {
  const active = state.rounds.filter((r) => r.status === "open" || r.status === "closed");
  if (active.length === 0) return null;
  return active[active.length - 1] ?? null;
}

export function getClosedRound(state: PlatformState): BettingRound | null {
  const closed = state.rounds.filter((r) => r.status === "closed");
  if (closed.length === 0) return null;
  return closed[closed.length - 1] ?? null;
}

export function getRoundBets(state: PlatformState, roundId: string): PlacedBet[] {
  return state.bets.filter((b) => b.roundId === roundId);
}

export function getRoundSettlements(state: PlatformState, roundId: string) {
  return state.settlements[roundId] ?? [];
}

function isBetOnFelt(state: PlatformState, bet: PlacedBet): boolean {
  const round = state.rounds.find((r) => r.id === bet.roundId);
  if (!round) return false;
  if (round.status === "open" || round.status === "closed") return true;
  return bet.working && round.status === "settled";
}

export function getChipsOnFelt(state: PlatformState): number {
  return state.bets.filter((b) => isBetOnFelt(state, b)).reduce((sum, b) => sum + b.amount, 0);
}

export function getChipsInBankrolls(state: PlatformState): number {
  return Object.values(state.bankrolls).reduce((sum, n) => sum + n, 0);
}

export interface ChipsInPlay {
  issued: number;
  inBankrolls: number;
  onFelt: number;
}

export function getChipsInPlay(state: PlatformState): ChipsInPlay {
  const inBankrolls = getChipsInBankrolls(state);
  const onFelt = getChipsOnFelt(state);
  return {
    issued: state.chipsIssuedTotal,
    inBankrolls,
    onFelt,
  };
}

export function buildBetsView<Rules, Result, LiveInput, State, BetTarget, Action>(
  state: PlatformState,
  module: GameModule<Rules, Result, LiveInput, State, BetTarget, Action>,
  moduleState: State,
): BetsView {
  const round = getCurrentRound(state);
  const roundBets = round ? getRoundBets(state, round.id) : [];
  const summaries = round
    ? module.bets.summary(roundBets as PlacedBet<BetTarget>[], moduleState)
    : [];
  const openRoundIds = new Set(
    state.rounds.filter((r) => r.status === "open").map((r) => r.id),
  );
  const openBets = state.bets.filter((b) => openRoundIds.has(b.roundId));
  return { round, summaries, openBets };
}

export function getSettlementTicker(state: PlatformState, roundId: string): string {
  const settlements = getRoundSettlements(state, roundId);
  if (settlements.length === 0) return "";

  const betById = new Map(state.bets.map((b) => [b.id, b]));
  const playerById = new Map(state.players.map((p) => [p.id, p]));

  const parts: string[] = [];
  for (const s of settlements) {
    const bet = betById.get(s.betId);
    if (!bet) continue;
    const player = playerById.get(bet.playerId);
    const name = player?.name ?? bet.playerId;
    const sign = s.profit >= 0 ? "+" : "";
    parts.push(`${name} ${sign}${s.profit}`);
  }
  return parts.join(" · ");
}

export function canUndoResult(state: PlatformState, resultId: string): { ok: boolean; reason?: string } {
  if (state.participation.bank !== "house") return { ok: true };

  const affectedRound = state.rounds.find((r) => r.resultId === resultId);
  if (!affectedRound) return { ok: true };

  const affectedIndex = state.rounds.findIndex((r) => r.id === affectedRound.id);
  const laterRoundIds = new Set(
    state.rounds.slice(affectedIndex + 1).map((r) => r.id),
  );
  const hasLaterBets = state.bets.some((b) => laterRoundIds.has(b.roundId));
  if (hasLaterBets) {
    return {
      ok: false,
      reason: "Undo blocked: bets exist for the next round. Void those bets first.",
    };
  }
  return { ok: true };
}

export function sortPlayers(
  players: Player[],
  state: PlatformState,
  sort: "bankroll" | "seat" | "joined",
): Player[] {
  const copy = [...players.filter((p) => p.status !== "removed")];
  switch (sort) {
    case "bankroll":
      return copy.sort(
        (a, b) => getBankroll(state, b.id) - getBankroll(state, a.id),
      );
    case "seat":
      return copy.sort((a, b) => (a.seat ?? 999) - (b.seat ?? 999));
    case "joined":
      return copy.sort(
        (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
      );
  }
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  bankroll: number;
  net: number;
}

export function buildLeaderboard(state: PlatformState, buyInByPlayer: Record<string, number>): LeaderboardEntry[] {
  return state.players
    .filter((p) => p.status !== "removed")
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      bankroll: getBankroll(state, p.id),
      net: getBankroll(state, p.id) - (buyInByPlayer[p.id] ?? 0),
    }));
}
