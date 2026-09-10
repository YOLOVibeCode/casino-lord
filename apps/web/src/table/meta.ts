import type { ComposedState, GameModule, TableEvent, TableMeta } from "@casino-lord/core";

export function countSeries(events: TableEvent[]): number {
  return events.filter((e) => e.type === "SERIES_STARTED").length;
}

export function currentSeriesStartedAt(events: TableEvent[]): string {
  const starts = events.filter((e) => e.type === "SERIES_STARTED");
  const last = starts[starts.length - 1];
  return last?.at ?? new Date(0).toISOString();
}

export function currentSeriesCommit(events: readonly TableEvent[]): string | null {
  const starts = events.filter((e) => e.type === "SERIES_STARTED");
  const last = starts[starts.length - 1];
  if (last?.type === "SERIES_STARTED" && last.commit) {
    return last.commit;
  }
  return null;
}

export function buildTableMeta<State>(
  composed: ComposedState<State>,
  events: TableEvent[],
  module: GameModule<unknown, unknown, unknown, State>,
  state: State,
): TableMeta {
  const seriesNumber = Math.max(1, countSeries(events));
  void module;
  void state;
  const resultCount = composed.platform.results.length;

  return {
    code: composed.platform.code,
    game: composed.platform.game,
    seriesNumber,
    resultIndex: resultCount + 1,
    participation: composed.platform.participation,
    playerCount: composed.platform.players.filter((p) => p.status === "active").length,
  };
}
