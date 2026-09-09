import type { RoadHand } from "../types.js";
import type { BigRoadColumn, BigRoadGridCell, RoadGrid } from "./types.js";

const ROWS = 6;

export function buildBigRoadColumns(hands: RoadHand[]): {
  columns: BigRoadColumn[];
  leadingTies: number;
} {
  const columns: BigRoadColumn[] = [];
  let leadingTies = 0;

  for (const hand of hands) {
    if (hand.outcome === "T") {
      if (columns.length === 0) {
        leadingTies++;
      } else {
        const lastCol = columns[columns.length - 1]!;
        const lastCell = lastCol.cells[lastCol.cells.length - 1]!;
        lastCell.ties++;
      }
      continue;
    }

    const side = hand.outcome;
    const lastCol = columns[columns.length - 1];
    if (!lastCol || lastCol.side !== side) {
      columns.push({
        side,
        cells: [{ playerPair: hand.playerPair, bankerPair: hand.bankerPair, ties: 0 }],
      });
    } else {
      lastCol.cells.push({ playerPair: hand.playerPair, bankerPair: hand.bankerPair, ties: 0 });
    }
  }

  return { columns, leadingTies };
}

export function layoutBigRoad(
  columns: BigRoadColumn[],
  leadingTies: number,
): RoadGrid<BigRoadGridCell> {
  if (columns.length === 0 && leadingTies === 0) {
    return emptyGrid(ROWS, 0);
  }

  type Placement = { row: number; col: number; cell: BigRoadGridCell };
  const placements: Placement[] = [];

  if (leadingTies > 0) {
    placements.push({
      row: 0,
      col: 0,
      cell: { kind: "leading-tie", count: leadingTies },
    });
  }

  let startCol = leadingTies > 0 ? 1 : 0;
  let prevMaxCol = leadingTies > 0 ? 0 : -1;

  for (let c = 0; c < columns.length; c++) {
    const column = columns[c]!;
    const colStart = Math.max(startCol, prevMaxCol + 1);
    let maxCol = colStart;

    for (let i = 0; i < column.cells.length; i++) {
      const cellData = column.cells[i]!;
      const row = Math.min(i, ROWS - 1);
      const col = colStart + Math.max(0, i - (ROWS - 1));
      maxCol = Math.max(maxCol, col);
      placements.push({
        row,
        col,
        cell: {
          kind: "result",
          side: column.side as "P" | "B",
          playerPair: cellData.playerPair,
          bankerPair: cellData.bankerPair,
          ties: cellData.ties,
        },
      });
    }

    prevMaxCol = maxCol;
    startCol = colStart;
  }

  const cols = placements.reduce((max, p) => Math.max(max, p.col + 1), 0);
  const grid = emptyGrid(ROWS, cols);
  for (const p of placements) {
    grid.cells[p.row]![p.col] = p.cell;
  }
  return grid;
}

function emptyGrid(rows: number, cols: number): RoadGrid<BigRoadGridCell> {
  return {
    rows,
    cols,
    cells: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, (): BigRoadGridCell => ({ kind: "empty" })),
    ),
  };
}
