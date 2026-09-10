import type { TableEvent } from "@casino-lord/core";
import { sliceEventsForSeries } from "./series.js";

export interface FairnessResponse {
  seriesNumber: number;
  seriesId: string;
  commit: string | null;
  seed?: string;
  draws: Array<{ from: number; to: number }>;
}

export interface FairnessSeriesSummary {
  number: number;
  seriesId: string;
  commit: string | null;
  seedRevealed: boolean;
}

export interface FairnessListResponse {
  series: FairnessSeriesSummary[];
}

function seriesStarts(events: TableEvent[]): Array<{ index: number; event: TableEvent }> {
  const starts: Array<{ index: number; event: TableEvent }> = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    if (event.type === "SERIES_STARTED") {
      starts.push({ index: i, event });
    }
  }
  return starts;
}

export function listSeriesFairness(events: TableEvent[]): FairnessSeriesSummary[] {
  const starts = seriesStarts(events);
  if (starts.length === 0) {
    return [
      {
        number: 1,
        seriesId: "series-1",
        commit: null,
        seedRevealed: false,
      },
    ];
  }

  return starts.map((start, index) => {
    const number = index + 1;
    const slice = sliceEventsForSeries(events, number);
    const end = slice.find((e) => e.type === "SERIES_ENDED");
    const startEvent = start.event;
    return {
      number,
      seriesId: startEvent.type === "SERIES_STARTED" ? startEvent.seriesId : `series-${number}`,
      commit: startEvent.type === "SERIES_STARTED" ? (startEvent.commit ?? null) : null,
      seedRevealed: end?.type === "SERIES_ENDED" && end.seed !== undefined,
    };
  });
}

export function buildFairnessResponse(
  events: TableEvent[],
  seriesNumber: number,
  _tableCode: string,
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

  return {
    seriesNumber,
    seriesId,
    commit,
    ...(seed !== undefined ? { seed } : {}),
    draws,
  };
}
