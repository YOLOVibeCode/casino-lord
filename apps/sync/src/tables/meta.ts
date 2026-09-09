import type { ComposedState, GameModule, TableEvent } from "@casino-lord/core";

export function countSeries(events: TableEvent[]): number {
  return events.filter((e) => e.type === "SERIES_STARTED").length;
}

export function seriesNumberFromEvents(events: TableEvent[]): number {
  return Math.max(1, countSeries(events));
}

export function resultCountFromState<State>(state: State): number {
  const results = (state as { results?: unknown[] }).results;
  return Array.isArray(results) ? results.length : 0;
}

export function buildTableMeta<State>(
  composed: ComposedState<State>,
  events: TableEvent[],
  module: GameModule<unknown, unknown, unknown, State>,
  state: State,
): { seriesNumber: number; resultCount: number } {
  void module;
  return {
    seriesNumber: seriesNumberFromEvents(events),
    resultCount: resultCountFromState(state),
  };
}
