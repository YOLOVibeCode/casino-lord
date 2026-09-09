import type { CrapsRules } from "./rules.js";
import type { CrapsResult, Face, Phase, Point, RollDecision, RollInfo } from "./types.js";

export function detectHard(a: Face | null, b: Face | null): boolean | null {
  if (a === null || b === null) return null;
  if (a !== b) return false;
  const total = a + b;
  if (total === 4 || total === 6 || total === 8 || total === 10) return true;
  return false;
}

export function deriveTotal(a: Face | null, b: Face | null, total?: number): number {
  if (a !== null && b !== null) return a + b;
  if (total !== undefined) return total;
  throw new Error("Total required when faces are unknown");
}

export function normalizeResult(input: {
  a: Face | null;
  b: Face | null;
  total?: number;
  hard?: boolean | null;
}): CrapsResult {
  const total = deriveTotal(input.a, input.b, input.total);
  const hard = input.hard !== undefined ? input.hard : detectHard(input.a, input.b);
  return { a: input.a, b: input.b, total, hard };
}

export function classifyRoll(
  result: CrapsResult,
  phase: Phase,
  pointBefore: Point | null,
): RollInfo {
  const { a, b, total, hard } = result;
  let decision: RollDecision = "none";
  let pointAfter = pointBefore;
  let nextPhase = phase;

  if (phase === "come_out") {
    if (total === 7 || total === 11) {
      decision = "natural";
    } else if (total === 2 || total === 3 || total === 12) {
      decision = "craps";
    } else if (
      total === 4 ||
      total === 5 ||
      total === 6 ||
      total === 8 ||
      total === 9 ||
      total === 10
    ) {
      decision = "point_established";
      pointAfter = total;
      nextPhase = "point";
    }
  } else if (pointBefore !== null) {
    if (total === pointBefore) {
      decision = "point_made";
      pointAfter = null;
      nextPhase = "come_out";
    } else if (total === 7) {
      decision = "seven_out";
      pointAfter = null;
      nextPhase = "come_out";
    }
  }

  return {
    a,
    b,
    total,
    hard,
    phase,
    pointBefore,
    pointAfter,
    decision,
  };
}

export function nextPhaseAndPoint(info: RollInfo): { phase: Phase; point: Point | null } {
  if (info.decision === "point_established") {
    return { phase: "point", point: info.total as Point };
  }
  if (info.decision === "point_made" || info.decision === "seven_out") {
    return { phase: "come_out", point: null };
  }
  return { phase: info.phase, point: info.pointBefore };
}

/** Appendix B theoretical distribution weights for totals 2–12. */
export function theoreticalDistribution(): number[] {
  const ways = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
  return ways.map((w) => w / 36);
}

export function trueOddsNumerator(point: Point): number {
  switch (point) {
    case 4:
    case 10:
      return 2;
    case 5:
    case 9:
      return 3;
    case 6:
    case 8:
      return 6;
  }
}

export function trueOddsDenominator(point: Point): number {
  switch (point) {
    case 4:
    case 10:
      return 1;
    case 5:
    case 9:
      return 2;
    case 6:
    case 8:
      return 5;
  }
}

export function placeOdds(point: Point): { num: number; den: number } {
  switch (point) {
    case 4:
    case 10:
      return { num: 9, den: 5 };
    case 5:
    case 9:
      return { num: 7, den: 5 };
    case 6:
    case 8:
      return { num: 7, den: 6 };
  }
}

export function maxOddsMultiple(point: Point, rules: CrapsRules): number {
  switch (rules.maxOdds) {
    case "1x":
      return 1;
    case "2x":
      return 2;
    case "3x":
      return 3;
    case "5x":
      return 5;
    case "10x":
      return 10;
    case "20x":
      return 20;
    case "100x":
      return 100;
    case "3-4-5x":
      switch (point) {
        case 4:
        case 10:
          return 3;
        case 5:
        case 9:
          return 4;
        case 6:
        case 8:
          return 5;
      }
  }
}

export function isCrapsTotal(total: number): boolean {
  return total === 2 || total === 3 || total === 12;
}

export function isNatural(total: number): boolean {
  return total === 7 || total === 11;
}
