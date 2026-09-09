import type { ComposedState, GameModule, TableEvent, TableMeta } from "@casino-lord/core";

export function countSeries(events: TableEvent[]): number {
  return events.filter((e) => e.type === "SERIES_STARTED").length;
}

export function currentSeriesStartedAt(events: TableEvent[]): string {
  const starts = events.filter((e) => e.type === "SERIES_STARTED");
  const last = starts[starts.length - 1];
  return last?.at ?? new Date(0).toISOString();
}

export function buildTableMeta<State>(
  composed: ComposedState<State>,
  events: TableEvent[],
  module: GameModule<unknown, unknown, unknown, State>,
  state: State,
): TableMeta {
  const seriesNumber = Math.max(1, countSeries(events));
  const results = (state as { results?: unknown[] }).results;
  const resultCount = Array.isArray(results) ? results.length : 0;

  return {
    code: composed.platform.code,
    game: composed.platform.game,
    seriesNumber,
    resultIndex: resultCount + 1,
    participation: composed.platform.participation,
    playerCount: composed.platform.players.filter((p) => p.status === "active").length,
  };
}
