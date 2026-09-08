/** Games supported by the platform (SPEC.md §6). */
export type GameId = "baccarat" | "roulette" | "craps" | "blackjack";

export const GAME_IDS: readonly GameId[] = ["baccarat", "roulette", "craps", "blackjack"];

/** Per-table participation switches (SPEC.md §5). */
export interface Participation {
  playerMode: "off" | "on";
  bank: "none" | "house";
  outcomeSource: "physical" | "virtual";
}

export const DEFAULT_PARTICIPATION: Participation = {
  playerMode: "off",
  bank: "none",
  outcomeSource: "physical",
};

/**
 * `bank = "house"` requires `playerMode = "on"` (SPEC.md §5.1).
 * Returns a reason string when invalid, or `null` when the combination is allowed.
 */
export function validateParticipation(p: Participation): string | null {
  if (p.bank === "house" && p.playerMode === "off") {
    return "bank=house requires playerMode=on";
  }
  return null;
}
