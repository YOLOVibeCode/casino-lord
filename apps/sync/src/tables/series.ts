import type { GameId, Series, TableEvent } from "@casino-lord/core";
import {
  buildSeriesFromEvents as buildSeriesFromEventsCore,
  sliceEventsForSeries as sliceEventsForSeriesCore,
} from "@casino-lord/core";
import { countSeries } from "./meta.js";

export const sliceEventsForSeries = sliceEventsForSeriesCore;

export function buildSeriesFromEvents<R>(
  events: TableEvent[],
  seriesNumber: number,
  game: GameId,
): Series<R> | null {
  return buildSeriesFromEventsCore(events, seriesNumber, game);
}

export function maxExportableSeries(events: TableEvent[]): number {
  return Math.max(1, countSeries(events));
}
