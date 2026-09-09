import type { GameId, GameModule, Series } from "@casino-lord/core";

function base64UrlEncode(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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
  const rulesJson = base64UrlEncode(input.rules);
  const header = `#casino-lord v3 game=${input.game} table=${input.code} series=${input.seriesNumber} started=${input.seriesStartedAt} source=${input.source} rules=${rulesJson}`;
  const body = input.module.exportSeries(input.series, input.rules);
  return `${header}\n${body}`;
}
