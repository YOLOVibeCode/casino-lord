export type WheelType = "european" | "american" | "french";

export type ZeroRule = "none" | "la_partage" | "en_prison";

export type StatsWindow = "session" | 50 | 100 | 200;

export interface RouletteRules {
  wheel: WheelType;
  zeroRule: ZeroRule;
  historyLength: number;
  statsWindow: StatsWindow;
  streakThreshold: number;
  zeroInDenominator: boolean;
  showSectors: boolean;
  sectorHeat: boolean;
  autoConfirm: boolean;
  insideMax: number;
  doublePrison: boolean;
  allowCallBets: boolean;
}

export const DEFAULT_ROULETTE_RULES: RouletteRules = {
  wheel: "european",
  zeroRule: "none",
  historyLength: 20,
  statsWindow: "session",
  streakThreshold: 6,
  zeroInDenominator: false,
  showSectors: true,
  sectorHeat: false,
  autoConfirm: false,
  insideMax: 0,
  doublePrison: false,
  allowCallBets: true,
};

export const FRENCH_ROULETTE_RULES: RouletteRules = {
  ...DEFAULT_ROULETTE_RULES,
  wheel: "french",
  zeroRule: "la_partage",
};

export function isEuropeanLayout(rules: RouletteRules): boolean {
  return rules.wheel === "european" || rules.wheel === "french";
}
