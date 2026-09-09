import { buildBigRoadColumns, layoutBigRoad } from "./roads/big-road.js";
import type { Outcome, RoadHand } from "./types.js";

export interface StreakInfo {
  side: "P" | "B";
  length: number;
  path: { x: number; y: number }[];
}

const ROWS = 6;

export function getCurrentStreak(hands: RoadHand[]): StreakInfo | null {
  const nonTie = hands.filter((h) => h.outcome !== "T");
  if (nonTie.length === 0) return null;

  const { columns, leadingTies } = buildBigRoadColumns(hands);
  if (columns.length === 0) return null;

  const lastCol = columns[columns.length - 1]!;
  if (lastCol.side === "T") return null;

  const side = lastCol.side as "P" | "B";
  const length = lastCol.cells.length;
  const path = streakPath(columns, leadingTies, columns.length - 1);
  return { side, length, path };
}

function streakPath(
  columns: ReturnType<typeof buildBigRoadColumns>["columns"],
  leadingTies: number,
  columnIndex: number,
): { x: number; y: number }[] {
  const grid = layoutBigRoad(columns, leadingTies);
  const path: { x: number; y: number }[] = [];

  let startCol = leadingTies > 0 ? 1 : 0;
  let prevMaxCol = leadingTies > 0 ? 0 : -1;

  for (let c = 0; c <= columnIndex; c++) {
    const column = columns[c]!;
    const colStart = Math.max(startCol, prevMaxCol + 1);
    let maxCol = colStart;

    if (c === columnIndex) {
      for (let i = 0; i < column.cells.length; i++) {
        const row = Math.min(i, ROWS - 1);
        const col = colStart + Math.max(0, i - (ROWS - 1));
        path.push({ x: col, y: row });
        maxCol = Math.max(maxCol, col);
      }
    } else {
      for (let i = 0; i < column.cells.length; i++) {
        const col = colStart + Math.max(0, i - (ROWS - 1));
        maxCol = Math.max(maxCol, col);
      }
    }

    prevMaxCol = maxCol;
    startCol = colStart;
  }

  if (path.length === 0 && grid.cols > 0) {
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const cell = grid.cells[row]?.[col];
        if (cell?.kind === "result") {
          path.push({ x: col, y: row });
        }
      }
    }
  }

  return path;
}

export function outcomeLabel(outcome: Outcome): string {
  switch (outcome) {
    case "P":
      return "PLAYER";
    case "B":
      return "BANKER";
    case "T":
      return "TIE";
  }
}

export function streakLabel(streak: StreakInfo | null): string {
  if (!streak) return "—";
  return `${outcomeLabel(streak.side)} × ${streak.length}`;
}

export function longestStreak(hands: RoadHand[]): StreakInfo | null {
  let best: StreakInfo | null = null;
  let currentSide: "P" | "B" | null = null;
  let currentLen = 0;

  for (const hand of hands) {
    if (hand.outcome === "T") continue;
    const side = hand.outcome as "P" | "B";
    if (side === currentSide) {
      currentLen++;
    } else {
      currentSide = side;
      currentLen = 1;
    }
    if (!best || currentLen > best.length) {
      best = { side, length: currentLen, path: [] };
    }
  }

  return best;
}
