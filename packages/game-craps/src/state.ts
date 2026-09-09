import { classifyRoll, normalizeResult, nextPhaseAndPoint } from "./engine.js";
import { DEFAULT_CRAPS_RULES, type CrapsRules } from "./rules.js";
import type {
  CrapsLiveInput,
  CrapsResult,
  CrapsState,
  Point,
  RollRecord,
  ShooterState,
  TableState,
} from "./types.js";

const EMPTY_SHOOTER: ShooterState = {
  rolls: [],
  rollCount: 0,
  pointsMade: 0,
  distinctPointsMade: [],
  ats: { small: [], tall: [] },
  hardWays: { "4": 0, "6": 0, "8": 0, "10": 0 },
  rollsSincePoint: 0,
};

const EMPTY_TABLE: TableState = {
  rolls: 0,
  shooters: 0,
  longestHand: 0,
  mostPointsMade: 0,
  distribution: Array.from({ length: 13 }, () => 0),
  sevensRolled: 0,
};

function addDistinctPoint(points: Point[], point: Point): Point[] {
  if (points.includes(point)) return points;
  return [...points, point].sort((a, b) => a - b);
}

function updateAts(ats: ShooterState["ats"], total: number): ShooterState["ats"] {
  const small = [...ats.small];
  const tall = [...ats.tall];
  if (total >= 2 && total <= 6 && !small.includes(total)) {
    small.push(total);
    small.sort((a, b) => a - b);
  }
  if (total >= 8 && total <= 12 && !tall.includes(total)) {
    tall.push(total);
    tall.sort((a, b) => a - b);
  }
  return { small, tall };
}

function applyHardWay(shooter: ShooterState, hard: boolean | null, total: number): ShooterState {
  if (hard !== true) return shooter;
  if (total === 4 || total === 6 || total === 8 || total === 10) {
    const key = String(total) as "4" | "6" | "8" | "10";
    return {
      ...shooter,
      hardWays: { ...shooter.hardWays, [key]: shooter.hardWays[key] + 1 },
    };
  }
  return shooter;
}

function applyRollToShooter(
  shooter: ShooterState,
  record: RollRecord,
  rules: CrapsRules,
): ShooterState {
  const { info, total, hard } = record;
  let next: ShooterState = {
    ...shooter,
    rolls: [...shooter.rolls, record],
    rollCount: shooter.rollCount + 1,
  };

  if (info.decision === "point_established") {
    next = { ...next, rollsSincePoint: 0 };
  } else if (info.phase === "point") {
    next = { ...next, rollsSincePoint: shooter.rollsSincePoint + 1 };
  }

  if (info.decision === "point_made") {
    next = {
      ...next,
      pointsMade: shooter.pointsMade + 1,
      distinctPointsMade: addDistinctPoint(shooter.distinctPointsMade, info.pointBefore as Point),
    };
  }

  if (rules.trackAllTallSmall) {
    next = { ...next, ats: updateAts(shooter.ats, total) };
  }

  next = applyHardWay(next, hard, total);
  return next;
}

function applyRollToTable(table: TableState, record: RollRecord): TableState {
  const total = record.total;
  const distribution = [...table.distribution];
  distribution[total] = (distribution[total] ?? 0) + 1;
  return {
    ...table,
    rolls: table.rolls + 1,
    distribution,
    sevensRolled: table.sevensRolled + (total === 7 ? 1 : 0),
  };
}

export function emptyShooterState(): ShooterState {
  return {
    ...EMPTY_SHOOTER,
    ats: { small: [], tall: [] },
    hardWays: { "4": 0, "6": 0, "8": 0, "10": 0 },
  };
}

export function initialState(rules: CrapsRules = DEFAULT_CRAPS_RULES): CrapsState {
  void rules;
  return {
    results: [],
    liveInput: { a: null, b: null },
    phase: "come_out",
    point: null,
    shooter: emptyShooterState(),
    table: { ...EMPTY_TABLE, distribution: Array.from({ length: 13 }, () => 0) },
    lastRoll: null,
    currentShooterId: null,
    shooterOrder: [],
    seriesLabel: null,
  };
}

export function buildRollRecord(
  id: string,
  result: CrapsResult,
  phase: Phase,
  point: Point | null,
): RollRecord {
  const info = classifyRoll(result, phase, point);
  return { ...result, id, info };
}

type Phase = import("./types.js").Phase;

export function rebuildFromResults(
  results: Array<{ id: string; data: CrapsResult }>,
  rules: CrapsRules,
  base: Pick<CrapsState, "currentShooterId" | "shooterOrder" | "seriesLabel" | "table">,
): CrapsState {
  let phase: Phase = "come_out";
  let point: Point | null = null;
  let shooter = emptyShooterState();
  let table = { ...base.table };
  let lastRoll: RollRecord | null = null;
  const rolls: RollRecord[] = [];

  for (const entry of results) {
    const result = normalizeResult(entry.data);
    const record = buildRollRecord(entry.id, result, phase, point);
    rolls.push(record);
    shooter = applyRollToShooter(shooter, record, rules);
    table = applyRollToTable(table, record);
    lastRoll = record;
    const next = nextPhaseAndPoint(record.info);
    phase = next.phase;
    point = next.point;

    if (record.info.decision === "seven_out") {
      table = {
        ...table,
        longestHand: Math.max(table.longestHand, shooter.rollCount),
        mostPointsMade: Math.max(table.mostPointsMade, shooter.pointsMade),
      };
    }
  }

  return {
    results: rolls,
    liveInput: { a: null, b: null },
    phase,
    point,
    shooter,
    table,
    lastRoll,
    currentShooterId: base.currentShooterId,
    shooterOrder: base.shooterOrder,
    seriesLabel: base.seriesLabel,
  };
}

export function resetShooterScope(state: CrapsState, label?: string): CrapsState {
  return {
    ...state,
    phase: "come_out",
    point: null,
    shooter: emptyShooterState(),
    seriesLabel: label ?? state.seriesLabel,
    table: {
      ...state.table,
      shooters: state.table.shooters + 1,
    },
  };
}

export function withLiveInput(state: CrapsState, liveInput: CrapsLiveInput): CrapsState {
  return { ...state, liveInput };
}
