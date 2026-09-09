import type { GameId } from "@casino-lord/core";
import { baccaratModule, DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { crapsModule, DEFAULT_CRAPS_RULES } from "@casino-lord/game-craps";
import { DEFAULT_ROULETTE_RULES, rouletteModule } from "@casino-lord/game-roulette";
import { blackjackModule, DEFAULT_BLACKJACK_RULES } from "@casino-lord/game-blackjack";
import type { Config } from "./config.js";
import { GAMES } from "./games.js";
import type { UntypedModule } from "./module-types.js";

export type { UntypedModule } from "./module-types.js";

const MODULES: Partial<Record<GameId, UntypedModule>> = {
  baccarat: baccaratModule as UntypedModule,
  craps: crapsModule as unknown as UntypedModule,
  roulette: rouletteModule as UntypedModule,
  blackjack: blackjackModule as unknown as UntypedModule,
};

const DEFAULT_RULES: Partial<Record<GameId, unknown>> = {
  baccarat: DEFAULT_BACCARAT_RULES,
  craps: DEFAULT_CRAPS_RULES,
  roulette: DEFAULT_ROULETTE_RULES,
  blackjack: DEFAULT_BLACKJACK_RULES,
};

export function isGameEnabled(config: Config, game: GameId): boolean {
  const entry = GAMES.find((g) => g.id === game);
  if (!entry?.enabled) {
    return false;
  }
  return config.enabledGames.includes(game);
}

export function getModule(game: GameId): UntypedModule | null {
  return MODULES[game] ?? null;
}

export function resolveRules(game: GameId): unknown {
  return DEFAULT_RULES[game] ?? {};
}

export function listEnabledGames(config: Config): GameId[] {
  return GAMES.filter((g) => g.enabled && config.enabledGames.includes(g.id)).map((g) => g.id);
}
