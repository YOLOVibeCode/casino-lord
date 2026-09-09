import type { BeadCell, BigRoadGridCell, DerivedCell, RoadGrid } from "./types.js";

export function renderBeadPlate(grid: RoadGrid<BeadCell>): string[] {
  return renderGrid(grid, (cell) => {
    if (cell.kind === "empty") return ".";
    return cell.outcome;
  });
}

export function renderBigRoad(grid: RoadGrid<BigRoadGridCell>): string[] {
  return renderGrid(grid, (cell) => {
    if (cell.kind === "empty") return ".";
    if (cell.kind === "leading-tie") return cell.count > 1 ? `/${cell.count}` : "/";
    const base = cell.side;
    if (cell.ties > 0) return cell.ties > 1 ? `${base}/${cell.ties}` : `${base}/`;
    return base;
  });
}

export function renderDerivedRoad(grid: RoadGrid<DerivedCell>): string[] {
  return renderGrid(grid, (cell) => {
    if (cell.kind === "empty") return ".";
    return cell.colour === "red" ? "R" : "B";
  });
}

function renderGrid<T>(grid: RoadGrid<T>, format: (cell: T) => string): string[] {
  if (grid.cols === 0) return ["(empty)"];

  const colWidths: number[] = [];
  for (let col = 0; col < grid.cols; col++) {
    let max = 1;
    for (let row = 0; row < grid.rows; row++) {
      const cell = grid.cells[row]?.[col];
      if (cell !== undefined) {
        max = Math.max(max, format(cell).length);
      }
    }
    colWidths[col] = max;
  }

  const lines: string[] = [];
  for (let row = 0; row < grid.rows; row++) {
    const parts: string[] = [];
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[row]?.[col];
      const text = cell !== undefined ? format(cell) : ".";
      parts.push(text.padEnd(colWidths[col]!));
    }
    lines.push(parts.join(" "));
  }
  return lines;
}

export function renderStats(hands: { outcome: string }[]): string {
  let p = 0;
  let b = 0;
  let t = 0;
  for (const h of hands) {
    if (h.outcome === "P") p++;
    else if (h.outcome === "B") b++;
    else t++;
  }
  return `P ${p}  B ${b}  T ${t}  ·  Hands ${hands.length}`;
}
