import type { DerivedCell, RoadGrid } from "../../roads/types.js";
import { derivedCellAriaLabel } from "./road-aria.js";
import { useRoadScroll } from "./road-scroll.js";
import "./road-grid.css";
import "./derived-road.css";

export type DerivedRoadVariant = "big-eye-boy" | "small-road" | "cockroach-pig";

interface DerivedRoadProps {
  grid: RoadGrid<DerivedCell>;
  variant: DerivedRoadVariant;
  predictions?: RoadGrid<DerivedCell>;
  label?: string;
  newColCount?: number;
}

function renderMark(cell: DerivedCell, variant: DerivedRoadVariant) {
  if (cell.kind !== "mark") return null;
  const colour = cell.colour;
  switch (variant) {
    case "big-eye-boy":
      return <div class={`derived-road__ring derived-road__ring--${colour}`} />;
    case "small-road":
      return <div class={`derived-road__disc derived-road__disc--${colour}`} />;
    case "cockroach-pig":
      return <div class={`derived-road__slash derived-road__slash--${colour}`} />;
  }
}

export function DerivedRoad({
  grid,
  variant,
  predictions,
  label,
  newColCount = 0,
}: DerivedRoadProps) {
  const displayGrid = predictions ?? grid;
  const baseCols = grid.cols;
  const predCols = predictions ? predictions.cols - baseCols : 0;
  const totalCols = Math.max(displayGrid.cols, 1);
  const { ref } = useRoadScroll(displayGrid.cols);

  return (
    <div class="derived-road" data-testid={`derived-road-${variant}`}>
      {label && <div class="derived-road__label">{label}</div>}
      <div class="road-grid" ref={ref}>
        <div
          class="road-grid__inner"
          style={{
            gridTemplateColumns: `repeat(${totalCols}, var(--road-cell-size))`,
            gridTemplateRows: `repeat(${displayGrid.rows}, var(--road-cell-size))`,
          }}
        >
          {Array.from({ length: displayGrid.rows }, (_, row) =>
            Array.from({ length: totalCols }, (_, col) => {
              const cell = displayGrid.cells[row]?.[col];
              const isPrediction = predictions !== undefined && col >= baseCols;
              const predSide: "B" | "P" | undefined = isPrediction
                ? col === baseCols
                  ? "B"
                  : "P"
                : undefined;
              const isNew = newColCount > 0 && !isPrediction && col >= baseCols - newColCount;
              return (
                <div
                  key={`${row}-${col}`}
                  class={`road-grid__cell${isNew ? " road-grid__cell--enter" : ""}${isPrediction ? " derived-road__prediction" : ""}`}
                  data-row={row}
                  data-col={col}
                  aria-label={
                    cell
                      ? derivedCellAriaLabel(cell, predSide)
                      : isPrediction
                        ? derivedCellAriaLabel({ kind: "empty" }, predSide)
                        : "Empty derived cell"
                  }
                >
                  {isPrediction && row === 0 && (
                    <span class="derived-road__prediction-label" aria-hidden="true">
                      {predSide === "B" ? "B?" : "P?"}
                    </span>
                  )}
                  {!isPrediction && cell && renderMark(cell, variant)}
                  {isPrediction && cell && renderMark(cell, variant)}
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
