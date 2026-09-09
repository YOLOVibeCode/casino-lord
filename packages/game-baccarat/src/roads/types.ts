import type { Outcome } from "../types.js";

export interface BigRoadCellData {
  playerPair: boolean;
  bankerPair: boolean;
  ties: number;
}

export interface BigRoadColumn {
  side: Outcome;
  cells: BigRoadCellData[];
}

export type BeadCell =
  | {
      kind: "result";
      outcome: Outcome;
      playerPair: boolean;
      bankerPair: boolean;
    }
  | {
      kind: "empty";
    };

export type BigRoadGridCell =
  | {
      kind: "result";
      side: "P" | "B";
      playerPair: boolean;
      bankerPair: boolean;
      ties: number;
    }
  | {
      kind: "leading-tie";
      count: number;
    }
  | {
      kind: "empty";
    };

export type DerivedCell =
  | {
      kind: "mark";
      colour: "red" | "blue";
    }
  | {
      kind: "empty";
    };

export interface RoadGrid<T> {
  rows: number;
  cols: number;
  cells: T[][];
}

export interface BuiltRoads {
  beadPlate: RoadGrid<BeadCell>;
  bigRoad: RoadGrid<BigRoadGridCell>;
  bigEyeBoy: RoadGrid<DerivedCell>;
  smallRoad: RoadGrid<DerivedCell>;
  cockroachPig: RoadGrid<DerivedCell>;
  bigEyePredictions?: RoadGrid<DerivedCell>;
  smallRoadPredictions?: RoadGrid<DerivedCell>;
  cockroachPredictions?: RoadGrid<DerivedCell>;
}
