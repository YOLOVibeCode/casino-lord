import type { BigRoadGridCell, RoadGrid } from "../roads/types.js";
import "./mini-big-road.css";

interface MiniBigRoadProps {
  grid: RoadGrid<BigRoadGridCell>;
  visibleCols?: number;
}

export function MiniBigRoad({ grid, visibleCols = 12 }: MiniBigRoadProps) {
  const startCol = Math.max(0, grid.cols - visibleCols);
  const colCount = grid.cols - startCol;

  if (colCount <= 0) {
    return (
      <div class="mini-big-road" data-testid="mini-big-road">
        <div class="mini-big-road__grid" style={{ gridTemplateColumns: "repeat(1, 20px)" }}>
          <div class="mini-big-road__cell" />
        </div>
      </div>
    );
  }

  return (
    <div class="mini-big-road" data-testid="mini-big-road">
      <div
        class="mini-big-road__grid"
        style={{
          gridTemplateColumns: `repeat(${colCount}, 20px)`,
          gridTemplateRows: `repeat(${grid.rows}, 20px)`,
        }}
      >
        {Array.from({ length: grid.rows }, (_, row) =>
          Array.from({ length: colCount }, (_, ci) => {
            const col = startCol + ci;
            const cell = grid.cells[row]?.[col];
            return (
              <div key={`${row}-${col}`} class="mini-big-road__cell">
                {cell?.kind === "result" && (
                  <div
                    class={`mini-big-road__dot mini-big-road__dot--${cell.side}`}
                    title={`${cell.side}${cell.playerPair ? " pp" : ""}${cell.bankerPair ? " bp" : ""}`}
                  />
                )}
                {cell?.kind === "leading-tie" && (
                  <span class="mini-big-road__tie">{cell.count}</span>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
