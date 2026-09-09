export type Face = 1 | 2 | 3 | 4 | 5 | 6;

export type Point = 4 | 5 | 6 | 8 | 9 | 10;

export type Phase = "come_out" | "point";

export type RollDecision =
  "natural" | "craps" | "point_established" | "point_made" | "seven_out" | "none";

export interface CrapsResult {
  a: Face | null;
  b: Face | null;
  total: number;
  hard: boolean | null;
}

export interface CrapsLiveInput {
  a: Face | null;
  b: Face | null;
}

export interface RollInfo {
  a: Face | null;
  b: Face | null;
  total: number;
  hard: boolean | null;
  phase: Phase;
  pointBefore: Point | null;
  pointAfter: Point | null;
  decision: RollDecision;
}

export interface RollRecord extends CrapsResult {
  id: string;
  info: RollInfo;
}

export interface AtsProgress {
  small: number[];
  tall: number[];
}

export interface ShooterState {
  rolls: RollRecord[];
  rollCount: number;
  pointsMade: number;
  distinctPointsMade: Point[];
  ats: AtsProgress;
  hardWays: Record<"4" | "6" | "8" | "10", number>;
  rollsSincePoint: number;
}

export interface TableState {
  rolls: number;
  shooters: number;
  longestHand: number;
  mostPointsMade: number;
  distribution: number[];
  sevensRolled: number;
}

export interface CrapsState {
  results: RollRecord[];
  liveInput: CrapsLiveInput;
  phase: Phase;
  point: Point | null;
  shooter: ShooterState;
  table: TableState;
  lastRoll: RollRecord | null;
  currentShooterId: string | null;
  shooterOrder: string[];
  seriesLabel: string | null;
}
