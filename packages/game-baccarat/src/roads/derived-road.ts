import type { BigRoadColumn } from "./types.js";
import type { DerivedCell, RoadGrid } from "./types.js";

const ROWS = 6;

export function buildDerivedRoad(columns: BigRoadColumn[], offset: number): RoadGrid<DerivedCell> {
  const marks: ("red" | "blue")[] = [];

  for (let c = 0; c < columns.length; c++) {
    for (let r = 0; r < columns[c]!.cells.length; r++) {
      if (!canMarkDerived(columns, c, r, offset)) continue;
      marks.push(derivedColour(columns, c, r, offset));
    }
  }

  return layoutDerivedMarks(marks);
}

function canMarkDerived(columns: BigRoadColumn[], c: number, r: number, offset: number): boolean {
  if (columns.length < offset + 1) return false;
  if (c < offset) return false;

  if (r === 0) {
    const colAtOffset = columns[offset]!;
    if (colAtOffset.cells.length >= 2) return true;
    return columns.length > offset + 1;
  }

  return true;
}

function derivedColour(
  columns: BigRoadColumn[],
  c: number,
  r: number,
  offset: number,
): "red" | "blue" {
  const refCol = columns[c - offset]!;
  const prevCol = columns[c - 1]!;

  if (r === 0) {
    const prevRef = columns[c - 1 - offset];
    if (!prevRef) return "red";
    return prevCol.cells.length === prevRef.cells.length ? "red" : "blue";
  }

  if (refCol.cells.length >= r + 1) return "red";
  if (refCol.cells.length === r) return "blue";
  return "red";
}

function layoutDerivedMarks(marks: ("red" | "blue")[]): RoadGrid<DerivedCell> {
  if (marks.length === 0) {
    return { rows: ROWS, cols: 0, cells: Array.from({ length: ROWS }, () => []) };
  }

  const derivedColumns: ("red" | "blue")[][] = [];
  for (const colour of marks) {
    const last = derivedColumns[derivedColumns.length - 1];
    if (!last || last[0] !== colour) {
      derivedColumns.push([colour]);
    } else {
      last.push(colour);
    }
  }

  const placements: { row: number; col: number; colour: "red" | "blue" }[] = [];
  let startCol = 0;
  let prevMaxCol = -1;

  for (let c = 0; c < derivedColumns.length; c++) {
    const column = derivedColumns[c]!;
    const colStart = Math.max(startCol, prevMaxCol + 1);
    let maxCol = colStart;

    for (let i = 0; i < column.length; i++) {
      const row = Math.min(i, ROWS - 1);
      const col = colStart + Math.max(0, i - (ROWS - 1));
      maxCol = Math.max(maxCol, col);
      placements.push({ row, col, colour: column[i]! });
    }

    prevMaxCol = maxCol;
    startCol = colStart;
  }

  const cols = placements.reduce((max, p) => Math.max(max, p.col + 1), 0);
  const cells: DerivedCell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: cols }, (): DerivedCell => ({ kind: "empty" })),
  );

  for (const p of placements) {
    cells[p.row]![p.col] = { kind: "mark", colour: p.colour };
  }

  return { rows: ROWS, cols, cells };
}
