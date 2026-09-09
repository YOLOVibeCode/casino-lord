import type { RoadHand } from "../types.js";
import type { BigRoadColumn } from "./types.js";
import { buildBigRoadColumns } from "./big-road.js";
import { buildDerivedRoad } from "./derived-road.js";
import type { DerivedCell, RoadGrid } from "./types.js";

export interface PredictionRoads {
  bigEyeBoy: RoadGrid<DerivedCell>;
  smallRoad: RoadGrid<DerivedCell>;
  cockroachPig: RoadGrid<DerivedCell>;
}

export function buildPredictions(hands: RoadHand[]): PredictionRoads {
  const simulate = (outcome: "P" | "B"): RoadHand[] => [
    ...hands,
    { outcome, playerPair: false, bankerPair: false },
  ];

  const { columns: bebCols } = buildBigRoadColumns(simulate("B"));
  const { columns: srCols } = buildBigRoadColumns(simulate("B"));
  const { columns: cpCols } = buildBigRoadColumns(simulate("B"));

  return {
    bigEyeBoy: appendPredictionColumn(
      buildDerivedRoad(bebCols, 1),
      simulate("B"),
      simulate("P"),
      1,
    ),
    smallRoad: appendPredictionColumn(buildDerivedRoad(srCols, 2), simulate("B"), simulate("P"), 2),
    cockroachPig: appendPredictionColumn(
      buildDerivedRoad(cpCols, 3),
      simulate("B"),
      simulate("P"),
      3,
    ),
  };
}

function appendPredictionColumn(
  baseGrid: RoadGrid<DerivedCell>,
  handsIfB: RoadHand[],
  handsIfP: RoadHand[],
  offset: number,
): RoadGrid<DerivedCell> {
  const { columns: colsB } = buildBigRoadColumns(handsIfB);
  const { columns: colsP } = buildBigRoadColumns(handsIfP);
  const gridB = buildDerivedRoad(colsB, offset);
  const gridP = buildDerivedRoad(colsP, offset);

  const lastB = lastMark(gridB);
  const lastP = lastMark(gridP);

  const newCols = baseGrid.cols + 2;
  const cells: DerivedCell[][] = Array.from({ length: baseGrid.rows }, (_, row) => {
    const rowCells = [...(baseGrid.cells[row] ?? [])];
    while (rowCells.length < newCols) rowCells.push({ kind: "empty" });
    if (row === 0) {
      rowCells[newCols - 2] = lastB ?? { kind: "empty" };
      rowCells[newCols - 1] = lastP ?? { kind: "empty" };
    }
    return rowCells;
  });

  return { rows: baseGrid.rows, cols: newCols, cells };
}

function lastMark(grid: RoadGrid<DerivedCell>): DerivedCell | undefined {
  for (let col = grid.cols - 1; col >= 0; col--) {
    for (let row = grid.rows - 1; row >= 0; row--) {
      const cell = grid.cells[row]?.[col];
      if (cell?.kind === "mark") return cell;
    }
  }
  return undefined;
}
