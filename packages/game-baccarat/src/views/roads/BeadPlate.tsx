import type { RoadGrid } from "../../roads/types.js";
import type { BeadCell } from "../../roads/types.js";
import { beadCellAriaLabel } from "./road-aria.js";
import { useRoadScroll } from "./road-scroll.js";
import "./road-grid.css";
import "./bead-plate.css";

interface BeadPlateProps {
  grid: RoadGrid<BeadCell>;
  newColCount?: number;
}

export function BeadPlate({ grid, newColCount = 0 }: BeadPlateProps) {
  const { ref } = useRoadScroll(grid.cols);
  const cols = Math.max(grid.cols, 1);

  return (
    <div class="road-grid bead-plate" data-testid="bead-plate" ref={ref}>
      <div
        class="road-grid__inner"
        style={{
          gridTemplateColumns: `repeat(${cols}, var(--road-cell-size))`,
          gridTemplateRows: `repeat(${grid.rows}, var(--road-cell-size))`,
        }}
      >
        {Array.from({ length: grid.rows }, (_, row) =>
          Array.from({ length: cols }, (_, col) => {
            const cell = grid.cells[row]?.[col];
            const isNew = newColCount > 0 && col >= grid.cols - newColCount;
            return (
              <div
                key={`${row}-${col}`}
                class={`road-grid__cell${isNew ? " road-grid__cell--enter" : ""}`}
                data-row={row}
                data-col={col}
                aria-label={cell ? beadCellAriaLabel(cell) : "Empty bead cell"}
              >
                {cell?.kind === "result" && (
                  <div class={`bead-plate__disc bead-plate__disc--${cell.outcome}`}>
                    {cell.outcome}
                    {cell.bankerPair && (
                      <span
                        class="bead-plate__pair-dot bead-plate__pair-dot--banker"
                        aria-hidden="true"
                      />
                    )}
                    {cell.playerPair && (
                      <span
                        class="bead-plate__pair-dot bead-plate__pair-dot--player"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
