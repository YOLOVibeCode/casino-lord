import type { GameModule, Series, TableSettings } from "@casino-lord/core";
import type { GameId } from "@casino-lord/core";

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
