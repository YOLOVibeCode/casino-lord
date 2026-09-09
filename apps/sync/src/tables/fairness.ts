import type { TableEvent } from "@casino-lord/core";
import { sliceEventsForSeries } from "./series.js";

export interface FairnessResponse {
  commit: string | null;
  seed?: string;
  draws: Array<{ from: number; to: number }>;
}

export function buildFairnessResponse(
  events: TableEvent[],
  seriesNumber: number,
  tableCode: string,
  seriesId: string,
): FairnessResponse {
  const slice = sliceEventsForSeries(events, seriesNumber);
  const start = slice.find((e) => e.type === "SERIES_STARTED");
  const end = slice.find((e) => e.type === "SERIES_ENDED");
  const commit = start?.type === "SERIES_STARTED" ? (start.commit ?? null) : null;
  const seed = end?.type === "SERIES_ENDED" ? end.seed : undefined;

  const draws: Array<{ from: number; to: number }> = [];
  for (const event of slice) {
    if (event.type === "RESULT_RECORDED" && event.result.rng) {
      draws.push({ from: event.result.rng.from, to: event.result.rng.to });
    }
  }

  void tableCode;
  void seriesId;

  return {
    commit,
    ...(seed !== undefined ? { seed } : {}),
    draws,
  };
}
