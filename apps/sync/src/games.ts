import type { GameId } from "@casino-lord/core";

export interface GameRegistryEntry {
  id: GameId;
  name: string;
  enabled: boolean;
}

export const GAMES: GameRegistryEntry[] = [
  { id: "baccarat", name: "Baccarat", enabled: true },
  { id: "roulette", name: "Roulette", enabled: false },
  { id: "craps", name: "Craps", enabled: true },
  { id: "blackjack", name: "Blackjack", enabled: false },
];
