import {
  buildExportEnvelope,
  buildSeriesFromEvents,
  replay,
  type GameModule,
  type Series,
  type TableEvent,
} from "@casino-lord/core";
import type { GameId } from "@casino-lord/core";

export function buildSeriesFromStoreEvents<R>(
  events: readonly TableEvent[],
  seriesNumber: number,
): Series<R> | null {
  const created = events.find((e) => e.type === "TABLE_CREATED");
  const game = created?.type === "TABLE_CREATED" ? created.game : "baccarat";
  return buildSeriesFromEvents([...events], seriesNumber, game);
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
  events: readonly TableEvent[];
}): string {
  const composed = replay([...input.events], input.module, input.rules, { code: input.code });
  const gameBody = input.module.exportSeries(input.series, input.rules);
  return buildExportEnvelope({
    game: input.game,
    code: input.code,
    seriesNumber: input.seriesNumber,
    seriesStartedAt: input.seriesStartedAt,
    source: input.source,
    rules: input.rules,
    series: input.series as Series<unknown>,
    gameBody,
    platform: composed.platform,
    events: input.events,
  });
}
