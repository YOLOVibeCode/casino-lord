import type { BaccaratRules } from "../rules.js";
import type { RoadHand } from "../types.js";
import { buildBeadPlate } from "./bead-plate.js";
import { buildBigRoadColumns, layoutBigRoad } from "./big-road.js";
import { buildDerivedRoad } from "./derived-road.js";
import { buildPredictions } from "./predictions.js";
import type { BuiltRoads } from "./types.js";

export function buildRoads(hands: RoadHand[], rules: BaccaratRules): BuiltRoads {
  const { columns, leadingTies } = buildBigRoadColumns(hands);
  const result: BuiltRoads = {
    beadPlate: buildBeadPlate(hands),
    bigRoad: layoutBigRoad(columns, leadingTies),
    bigEyeBoy: buildDerivedRoad(columns, 1),
    smallRoad: buildDerivedRoad(columns, 2),
    cockroachPig: buildDerivedRoad(columns, 3),
  };

  if (rules.predictionCells) {
    const predictions = buildPredictions(hands);
    result.bigEyePredictions = predictions.bigEyeBoy;
    result.smallRoadPredictions = predictions.smallRoad;
    result.cockroachPredictions = predictions.cockroachPig;
  }

  return result;
}

export { buildBeadPlate } from "./bead-plate.js";
export { buildBigRoadColumns, layoutBigRoad } from "./big-road.js";
export { buildDerivedRoad } from "./derived-road.js";
export { buildPredictions } from "./predictions.js";
export { renderBeadPlate, renderBigRoad, renderDerivedRoad, renderStats } from "./render-ascii.js";
export type { BuiltRoads, RoadGrid } from "./types.js";
