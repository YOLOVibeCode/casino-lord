import type { BigRoadGridCell, RoadGrid } from "../../roads/types.js";
import { bigRoadCellAriaLabel } from "./road-aria.js";
import { useRoadScroll } from "./road-scroll.js";
import "./road-grid.css";
import "./big-road.css";

interface BigRoadProps {
  grid: RoadGrid<BigRoadGridCell>;
  newColCount?: number;
}

export function BigRoad({ grid, newColCount = 0 }: BigRoadProps) {
  const { ref } = useRoadScroll(grid.cols);
  const cols = Math.max(grid.cols, 1);

  return (
    <div class="road-grid big-road" data-testid="big-road" ref={ref}>
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
                data-testid={`big-road-cell-${row}-${col}`}
                aria-label={cell ? bigRoadCellAriaLabel(cell) : "Empty big road cell"}
              >
                {cell?.kind === "result" && (
                  <div class={`big-road__ring big-road__ring--${cell.side}`}>
                    <span aria-hidden="true">{cell.side}</span>
                    {cell.ties > 0 && (
                      <>
                        <span class="big-road__tie-slash" aria-hidden="true" />
                        {cell.ties > 1 && (
                          <span class="big-road__tie-count" aria-hidden="true">
                            {cell.ties}
                          </span>
                        )}
                      </>
                    )}
                    {cell.playerPair && (
                      <span
                        class="big-road__pair-dot big-road__pair-dot--player"
                        aria-hidden="true"
                      />
                    )}
                    {cell.bankerPair && (
                      <span
                        class="big-road__pair-dot big-road__pair-dot--banker"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                )}
                {cell?.kind === "leading-tie" && (
                  <div class="big-road__leading-tie">{cell.count > 1 ? cell.count : ""}</div>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
