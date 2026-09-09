import type { BetsView, LayoutPreset, TableMeta } from "@casino-lord/core";
import type { BaccaratRules } from "../rules.js";
import type { BaccaratState } from "../state.js";
import { CurrentHandPanel } from "./CurrentHandPanel.js";
import { BeadPlate, BigRoad, DerivedRoad } from "./roads/index.js";
import { useRoadColDelta } from "./use-road-col-delta.js";
import "./baccarat-tokens.css";
import "./display-view.css";

export interface DisplayViewProps {
  state: BaccaratState;
  rules: BaccaratRules;
  table: TableMeta;
  bets: BetsView;
  layout: LayoutPreset;
}

function footerStats(state: BaccaratState): {
  playerPairs: number;
  bankerPairs: number;
  naturals: number;
} {
  let playerPairs = 0;
  let bankerPairs = 0;
  let naturals = 0;
  for (const entry of state.results) {
    if (entry.data.playerPair) playerPairs++;
    if (entry.data.bankerPair) bankerPairs++;
    if (entry.data.natural) naturals++;
  }
  return { playerPairs, bankerPairs, naturals };
}

export function DisplayView({ state, rules, layout }: DisplayViewProps) {
  const { roads } = state;
  const layoutId = layout.id;
  const showCurrentHand = layoutId !== "roads-only";
  const stats = footerStats(state);
  const newBeadCols = useRoadColDelta(roads.beadPlate.cols);
  const newBigRoadCols = useRoadColDelta(roads.bigRoad.cols);
  const newBigEyeCols = useRoadColDelta(roads.bigEyeBoy.cols);
  const newSmallRoadCols = useRoadColDelta(roads.smallRoad.cols);
  const newCockroachCols = useRoadColDelta(roads.cockroachPig.cols);

  const predictions = rules.predictionCells
    ? {
        bigEye: roads.bigEyePredictions,
        small: roads.smallRoadPredictions,
        cockroach: roads.cockroachPredictions,
      }
    : null;

  return (
    <div
      class={`baccarat-display display-view display-view--${layoutId}`}
      data-testid="display-view"
      data-layout={layoutId}
    >
      <div class="display-view__top">
        <div class="display-view__bead">
          <div class="display-view__road-label">BEAD PLATE</div>
          <BeadPlate grid={roads.beadPlate} newColCount={newBeadCols} />
        </div>
        <div class="display-view__big-road-wrap">
          <div class="display-view__road-label">BIG ROAD</div>
          <BigRoad grid={roads.bigRoad} newColCount={newBigRoadCols} />
        </div>
      </div>

      <div class="display-view__middle">
        {showCurrentHand && <CurrentHandPanel state={state} />}
        <div>
          <DerivedRoad
            grid={roads.bigEyeBoy}
            variant="big-eye-boy"
            label="BIG EYE BOY"
            newColCount={newBigEyeCols}
            {...(predictions?.bigEye ? { predictions: predictions.bigEye } : {})}
          />
        </div>
        <div>
          <DerivedRoad
            grid={roads.smallRoad}
            variant="small-road"
            label="SMALL ROAD"
            newColCount={newSmallRoadCols}
            {...(predictions?.small ? { predictions: predictions.small } : {})}
          />
        </div>
      </div>

      <div class="display-view__middle">
        {!showCurrentHand && <div />}
        <div>
          <DerivedRoad
            grid={roads.cockroachPig}
            variant="cockroach-pig"
            label="COCKROACH PIG"
            newColCount={newCockroachCols}
            {...(predictions?.cockroach ? { predictions: predictions.cockroach } : {})}
          />
        </div>
        <div class="display-view__footer">
          <span data-testid="footer-player-pairs">P PAIR {stats.playerPairs}</span>
          <span>·</span>
          <span data-testid="footer-banker-pairs">B PAIR {stats.bankerPairs}</span>
          <span>·</span>
          <span data-testid="footer-naturals">NATURALS {stats.naturals}</span>
        </div>
      </div>
    </div>
  );
}
