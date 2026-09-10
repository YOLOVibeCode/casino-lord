import type { GameModule, Series, TableEvent } from "@casino-lord/core";
import type { GameId } from "@casino-lord/core";

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

function sliceEventsForSeries(events: TableEvent[], seriesNumber: number): TableEvent[] {
  const starts = seriesStarts(events);
  if (starts.length === 0) {
    return events.filter((e) => e.type !== "TABLE_CREATED");
  }

  const startIdx = starts[seriesNumber - 1]?.index;
  if (startIdx === undefined) {
    return [];
  }

  const endIdx = starts[seriesNumber]?.index ?? events.length;
  return events.slice(startIdx, endIdx);
}

export function buildSeriesFromStoreEvents<R>(
  events: readonly TableEvent[],
  seriesNumber: number,
): Series<R> | null {
  const eventList = [...events];
  const starts = seriesStarts(eventList);
  const startEvent = starts[seriesNumber - 1]?.event;
  const slice = sliceEventsForSeries(eventList, seriesNumber);

  if (seriesNumber > 1 && !startEvent) {
    return null;
  }

  const startedAt =
    startEvent?.type === "SERIES_STARTED"
      ? startEvent.at
      : (eventList.find((e) => e.type === "TABLE_CREATED")?.at ?? new Date(0).toISOString());

  const seriesId =
    startEvent?.type === "SERIES_STARTED" ? startEvent.seriesId : `series-${seriesNumber}`;

  const results = slice
    .filter((e) => e.type === "RESULT_RECORDED")
    .map((e) => {
      if (e.type !== "RESULT_RECORDED") {
        throw new Error("unreachable");
      }
      return e.result;
    });

  const endEvent = slice.find((e) => e.type === "SERIES_ENDED");

  return {
    id: seriesId,
    number: seriesNumber,
    startedAt,
    ...(startEvent?.type === "SERIES_STARTED" && startEvent.label !== undefined
      ? { label: startEvent.label }
      : {}),
    ...(startEvent?.type === "SERIES_STARTED" && startEvent.commit !== undefined
      ? { commit: startEvent.commit }
      : {}),
    ...(endEvent?.type === "SERIES_ENDED" && endEvent.seed !== undefined
      ? { seed: endEvent.seed }
      : {}),
    results,
    rounds: [],
  } as Series<R>;
}

export function buildExportText<R>(input: {
  game: GameId;
  code: string;
  seriesNumber: number;
  seriesStartedAt: string;
  source: "physical" | "virtual";
  rules: unknown;
  module: GameModule<unknown, R, unknown, unknown>;
  series: Series<R>;
}): string {
  const rulesJson = btoa(JSON.stringify(input.rules))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const header = `#casino-lord v3 game=${input.game} table=${input.code} series=${input.seriesNumber} started=${input.seriesStartedAt} source=${input.source} rules=${rulesJson}`;
  const body = input.module.exportSeries(input.series, input.rules);
  return `${header}\n${body}`;
}
