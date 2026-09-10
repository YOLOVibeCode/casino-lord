import { describe, expect, it } from "vitest";
import { buildExportText, buildSeriesFromStoreEvents } from "./export.js";
import { buildExportText as buildSyncExportText } from "../../../sync/src/tables/export.js";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { rouletteModule } from "@casino-lord/game-roulette";
import { DEFAULT_ROULETTE_RULES } from "@casino-lord/game-roulette";
import { ev } from "@casino-lord/core/testing";

function baccaratExportEvents() {
  const settings = {
    participation: {
      playerMode: "on" as const,
      bank: "house" as const,
      outcomeSource: "virtual" as const,
    },
    rules: DEFAULT_BACCARAT_RULES,
    display: { showBankrolls: true, playersSort: "bankroll" as const },
    betting: { defaultBuyIn: 500, tableMin: 1, tableMax: 10000 },
  };
  return [
    ev(1, "2026-01-01T00:00:01.000Z", {
      type: "TABLE_CREATED",
      game: "baccarat",
      participation: settings.participation,
      settings,
    }),
    ev(2, "2026-01-01T00:00:02.000Z", {
      type: "SERIES_STARTED",
      seriesId: "11111111-2222-4333-8444-555555555555",
      commit: "a".repeat(64),
    }),
    ev(3, "2026-01-01T00:00:03.000Z", {
      type: "PLAYER_JOINED",
      player: {
        id: "p1",
        name: "Ana",
        color: "#f00",
        status: "active",
        joinedAt: "2026-01-01T00:00:03.000Z",
      },
    }),
    ev(4, "2026-01-01T00:00:04.000Z", {
      type: "BANK_ISSUED",
      playerId: "p1",
      amount: 500,
      reason: "buyin",
    }),
    ev(5, "2026-01-01T00:00:05.000Z", {
      type: "BETS_OPENED",
      roundId: "r1",
    }),
    ev(6, "2026-01-01T00:00:06.000Z", {
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "banker",
        amount: 100,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:06.000Z",
        originRoundId: "r1",
      },
    }),
    ev(7, "2026-01-01T00:00:07.000Z", {
      type: "BETS_CLOSED",
      roundId: "r1",
      by: "dealer",
    }),
    ev(8, "2026-01-01T00:00:08.000Z", {
      type: "RESULT_RECORDED",
      result: {
        id: "res1",
        index: 0,
        recordedAt: "2026-01-01T00:00:08.000Z",
        quick: true,
        source: "virtual",
        by: "system",
        roundId: "r1",
        data: {
          cards: null,
          outcome: "B",
          playerTotal: 5,
          bankerTotal: 9,
          playerPair: false,
          bankerPair: false,
          natural: false,
        },
      },
    }),
    ev(9, "2026-01-01T00:00:09.000Z", {
      type: "SERIES_ENDED",
      seriesId: "11111111-2222-4333-8444-555555555555",
      seed: "010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
    }),
  ];
}

describe("buildSeriesFromStoreEvents", () => {
  it("preserves virtual source on result envelopes", () => {
    const events = [
      {
        type: "TABLE_CREATED" as const,
        game: "baccarat" as const,
        participation: {},
        settings: {},
      },
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
  it("includes virtual source, commit, seed, players, and bets", () => {
    const events = baccaratExportEvents();
    const series = buildSeriesFromStoreEvents(events, 1)!;
    const text = buildExportText({
      game: "baccarat",
      code: "K7X2PQ",
      seriesNumber: 1,
      seriesStartedAt: series.startedAt,
      source: "virtual",
      rules: DEFAULT_BACCARAT_RULES,
      module: baccaratModule,
      series,
      events,
    });
    expect(text).toContain("source=virtual");
    expect(text).toContain("commit=" + "a".repeat(64));
    expect(text).toContain(
      "seed=010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
    );
    expect(text).toContain("#players");
    expect(text).toContain("#bets");
  });

  it("matches sync export bytes for the same log", () => {
    const events = baccaratExportEvents();
    const series = buildSeriesFromStoreEvents(events, 1)!;
    const input = {
      game: "baccarat" as const,
      code: "K7X2PQ",
      seriesNumber: 1,
      seriesStartedAt: series.startedAt,
      source: "virtual" as const,
      rules: DEFAULT_BACCARAT_RULES,
      module: baccaratModule,
      series,
      events,
    };
    expect(buildExportText(input)).toBe(buildSyncExportText(input));
  });

  it("includes roulette bet targets in export", () => {
    const settings = {
      participation: {
        playerMode: "on" as const,
        bank: "house" as const,
        outcomeSource: "virtual" as const,
      },
      rules: DEFAULT_ROULETTE_RULES,
      display: { showBankrolls: true, playersSort: "bankroll" as const },
      betting: { defaultBuyIn: 500, tableMin: 1, tableMax: 10000 },
    };
    const events = [
      ev(1, "2026-01-01T00:00:01.000Z", {
        type: "TABLE_CREATED",
        game: "roulette",
        participation: settings.participation,
        settings,
      }),
      ev(2, "2026-01-01T00:00:02.000Z", {
        type: "SERIES_STARTED",
        seriesId: "roulette-series-1",
        commit: "b".repeat(64),
      }),
      ev(3, "2026-01-01T00:00:03.000Z", {
        type: "BETS_OPENED",
        roundId: "r1",
      }),
      ev(4, "2026-01-01T00:00:04.000Z", {
        type: "BETS_CLOSED",
        roundId: "r1",
        by: "dealer",
      }),
      ev(5, "2026-01-01T00:00:05.000Z", {
        type: "RESULT_RECORDED",
        result: {
          id: "res1",
          index: 0,
          recordedAt: "2026-01-01T00:00:05.000Z",
          quick: true,
          source: "virtual",
          by: "system",
          roundId: "r1",
          data: { pocket: 17, wheelIndex: 5, color: "black", parity: "odd", range: "high" },
        },
      }),
    ];
    const series = buildSeriesFromStoreEvents(events, 1)!;
    const text = buildExportText({
      game: "roulette",
      code: "TEST01",
      seriesNumber: 1,
      seriesStartedAt: series.startedAt,
      source: "virtual",
      rules: DEFAULT_ROULETTE_RULES,
      module: rouletteModule,
      series,
      events,
    });
    expect(text).toContain("#players");
    expect(text).toContain("#bets");
    expect(
      buildExportText({
        game: "roulette",
        code: "TEST01",
        seriesNumber: 1,
        seriesStartedAt: series.startedAt,
        source: "virtual",
        rules: DEFAULT_ROULETTE_RULES,
        module: rouletteModule,
        series,
        events,
      }),
    ).toBe(
      buildSyncExportText({
        game: "roulette",
        code: "TEST01",
        seriesNumber: 1,
        seriesStartedAt: series.startedAt,
        source: "virtual",
        rules: DEFAULT_ROULETTE_RULES,
        module: rouletteModule,
        series,
        events,
      }),
    );
  });
});
