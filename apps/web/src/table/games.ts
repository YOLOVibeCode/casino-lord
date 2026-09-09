import type { GameId } from "@casino-lord/core";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { crapsModule } from "@casino-lord/game-craps";
import { rouletteModule } from "@casino-lord/game-roulette";
import { blackjackModule } from "@casino-lord/game-blackjack";
import type { UntypedGameModule } from "./module-types.js";
import { asUntypedModule } from "./module-types.js";

export interface GameEntry {
  id: GameId;
  name: string;
  module?: UntypedGameModule;
  enabled: boolean;
}

export const GAMES: GameEntry[] = [
  { id: "baccarat", name: "Baccarat", module: asUntypedModule(baccaratModule), enabled: true },
  {
    id: "roulette",
    name: "Roulette",
    module: asUntypedModule(rouletteModule),
    enabled: true,
  },
  { id: "craps", name: "Craps", module: asUntypedModule(crapsModule), enabled: true },
  { id: "blackjack", name: "Blackjack", module: asUntypedModule(blackjackModule), enabled: true },
];

export function getGame(id: string): GameEntry | undefined {
  return GAMES.find((g) => g.id === id);
}
