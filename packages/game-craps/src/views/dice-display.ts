import type { RollDecision, RollInfo } from "../types.js";
import type { CrapsResult, Face, Point } from "../types.js";

const PIP_LAYOUT: Record<Face, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function pipLayout(face: Face): number[] {
  return PIP_LAYOUT[face];
}

export function formatFacePair(a: Face | null, b: Face | null): string {
  if (a === null || b === null) return "—";
  return `${a}-${b}`;
}

export function decisionLabel(decision: RollDecision): string {
  switch (decision) {
    case "natural":
      return "NATURAL";
    case "craps":
      return "CRAPS";
    case "point_established":
      return "POINT ESTABLISHED";
    case "point_made":
      return "POINT MADE";
    case "seven_out":
      return "SEVEN OUT";
    default:
      return "NO DECISION";
  }
}

export function rollBadge(info: RollInfo): string | null {
  if (info.hard === true) return "H";
  switch (info.decision) {
    case "point_made":
      return "✔";
    case "seven_out":
      return "⊘";
    case "natural":
      return "N";
    case "craps":
      return "C";
    default:
      return null;
  }
}

export function ruleHintLine(
  info: RollInfo | null,
  phase: "come_out" | "point",
  point: Point | null,
): string {
  if (!info) {
    if (phase === "come_out") return "Come-out roll — enter dice";
    if (point !== null) return `Point is ${point} — enter dice`;
    return "Enter dice";
  }

  const faces = formatFacePair(info.a, info.b);
  const hardPart = info.hard === true ? " HARD" : info.hard === false ? "" : "";

  switch (info.decision) {
    case "natural":
      return `${info.total} (${faces}) — NATURAL`;
    case "craps":
      return `${info.total} (${faces}) — CRAPS on come-out`;
    case "point_established":
      return `${info.total} (${faces}) — POINT ESTABLISHED`;
    case "point_made":
      return `${info.total} (${faces})${hardPart} — POINT MADE · new come-out`;
    case "seven_out":
      return `${info.total} (${faces}) — SEVEN OUT · next shooter`;
    default:
      if (info.hard === true) {
        return `${info.total} (${faces}) HARD — no decision`;
      }
      return `${info.total} (${faces}) — no decision`;
  }
}

export function classificationSummary(info: RollInfo): string {
  const base = decisionLabel(info.decision);
  if (info.hard === true && info.decision === "none") return `HARD ${info.total}`;
  return base;
}

export function puckLabel(on: boolean, point: Point | null): string {
  if (on && point !== null) return `PUCK: ON ${point}`;
  return "PUCK: OFF";
}

export function previewResult(result: CrapsResult): RollInfo | null {
  if (result.a === null && result.b === null) return null;
  return {
    a: result.a,
    b: result.b,
    total: result.total,
    hard: result.hard,
    phase: "come_out",
    pointBefore: null,
    pointAfter: null,
    decision: "none",
  };
}
