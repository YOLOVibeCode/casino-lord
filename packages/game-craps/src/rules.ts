export type MaxOddsRule = "1x" | "2x" | "3x" | "3-4-5x" | "5x" | "10x" | "20x" | "100x";

export type DistributionWindow = "shooter" | "table";

export interface CrapsRules {
  maxOdds: MaxOddsRule;
  field12: 2 | 3;
  field2: 2 | 3;
  buyVigOnWin: boolean;
  fire4: number;
  fire5: number;
  fire6: number;
  trackFire: boolean;
  trackAllTallSmall: boolean;
  hotShooterThreshold: number;
  distributionWindow: DistributionWindow;
  autoNewShooterOnSevenOut: boolean;
  showLiveDice: boolean;
  barNumber: 2 | 12;
  putBets: boolean;
  placeWorkingOnComeOut: boolean;
  shooterMustBetLine: boolean;
  shooterIdleSec: number;
  hornHigh: boolean;
}

export const DEFAULT_CRAPS_RULES: CrapsRules = {
  maxOdds: "3-4-5x",
  field12: 3,
  field2: 2,
  buyVigOnWin: false,
  fire4: 24,
  fire5: 249,
  fire6: 999,
  trackFire: true,
  trackAllTallSmall: false,
  hotShooterThreshold: 20,
  distributionWindow: "shooter",
  autoNewShooterOnSevenOut: true,
  showLiveDice: true,
  barNumber: 12,
  putBets: false,
  placeWorkingOnComeOut: false,
  shooterMustBetLine: true,
  shooterIdleSec: 45,
  hornHigh: true,
};
