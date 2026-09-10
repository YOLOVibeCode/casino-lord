import { describe, expect, it } from "vitest";
import { buildExportText, buildSeriesFromStoreEvents } from "./export.js";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";

describe("buildSeriesFromStoreEvents", () => {
  it("preserves virtual source on result envelopes", () => {
    const events = [
      { type: "TABLE_CREATED" as const, game: "baccarat" as const, participation: {}, settings: {} },
      {
        type: "SERIES_STARTED" as const,
        seriesId: "s1",
        at: "2026-01-01T00:00:00.000Z",
        seq: 1,
      },
      {
        type: "RESULT_RECORDED" as const,
        seq: 2,
        at: "2026-01-01T00:00:01.000Z",
        result: {
          id: "r1",
          index: 0,
          recordedAt: "2026-01-01T00:00:01.000Z",
          quick: false,
          source: "virtual" as const,
          by: "system" as const,
          data: { outcome: "B" },
        },
      },
    ];

    const series = buildSeriesFromStoreEvents(events, 1);
    expect(series?.results[0]?.source).toBe("virtual");
    expect(series?.results[0]?.by).toBe("system");
  });
});

describe("buildExportText", () => {
  it("includes virtual source in header", () => {
    const series = buildSeriesFromStoreEvents(
      [
        { type: "TABLE_CREATED", game: "baccarat", participation: {}, settings: {} },
        { type: "SERIES_STARTED", seriesId: "s1", at: "2026-01-01T00:00:00.000Z", seq: 1 },
      ],
      1,
    )!;
    const text = buildExportText({
      game: "baccarat",
      code: "K7X2PQ",
      seriesNumber: 1,
      seriesStartedAt: series.startedAt,
      source: "virtual",
      rules: DEFAULT_BACCARAT_RULES,
      module: baccaratModule,
      series,
    });
    expect(text).toContain("source=virtual");
  });
});
