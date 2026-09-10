import { describe, expect, it } from "vitest";
import {
  base64UrlEncodeJson,
  buildExportEnvelope,
  buildExportHeader,
  buildSeriesFromEvents,
  encodeBetTargetForExport,
  parseExportEnvelope,
  prefixEventsThroughSeries,
  sliceEventsForSeries,
} from "./export-envelope.js";
import { replay } from "./replay.js";
import {
  createStubModule,
  ev,
  houseSettings,
  resultEnvelope,
  STUB_RULES,
} from "./testing/stub-module.js";

describe("export-envelope", () => {
  it("builds Appendix A header with commit, seed, and seriesId", () => {
    const header = buildExportHeader({
      game: "baccarat",
      code: "K7X2PQ",
      seriesNumber: 1,
      seriesStartedAt: "2026-01-01T00:00:02.000Z",
      source: "virtual",
      rules: STUB_RULES,
      commit: "a".repeat(64),
      seed: "010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
      seriesId: "11111111-2222-4333-8444-555555555555",
    });
    expect(header).toContain("commit=" + "a".repeat(64));
    expect(header).toContain(
      "seed=010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
    );
    expect(header).toContain("seriesId=11111111-2222-4333-8444-555555555555");
    expect(header).toContain(`rules=${base64UrlEncodeJson(STUB_RULES)}`);
  });

  it("builds full envelope with players and bets", () => {
    const module = createStubModule();
    const settings = houseSettings();
    const events = [
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
          type: "high",
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
        result: resultEnvelope("res1", 0, 15, "r1"),
      }),
      ev(9, "2026-01-01T00:00:09.000Z", {
        type: "SERIES_ENDED",
        seriesId: "11111111-2222-4333-8444-555555555555",
        seed: "010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
      }),
    ];

    const composed = replay(events, module, STUB_RULES, { code: "K7X2PQ" });
    const series = buildSeriesFromEvents<{ value: number }>(events, 1, "baccarat")!;
    const body = module.exportSeries(series, STUB_RULES);
    const text = buildExportEnvelope({
      game: "baccarat",
      code: "K7X2PQ",
      seriesNumber: 1,
      seriesStartedAt: series.startedAt,
      source: "virtual",
      rules: STUB_RULES,
      series,
      gameBody: body,
      platform: composed.platform,
      events,
    });

    expect(text).toContain("#players");
    expect(text).toContain("p1 Ana issued=500");
    expect(text).toContain("#bets");
    expect(text).toContain("r1 p1 high 100 win 100");

    const parsed = parseExportEnvelope(text);
    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.header.commit).toBe("a".repeat(64));
    expect(parsed.header.seriesId).toBe("11111111-2222-4333-8444-555555555555");
    expect(parsed.players).toHaveLength(1);
    expect(parsed.bets).toHaveLength(1);

    const imported = module.importSeries(parsed.body, STUB_RULES);
    expect("error" in imported).toBe(false);
    if ("error" in imported) return;
    expect(imported.results).toEqual([{ value: 15 }]);
  });

  it("encodes complex bet targets as base64url JSON", () => {
    const encoded = encodeBetTargetForExport("straight", { kind: "straight", pocket: 17 });
    expect(encoded.startsWith("straight:")).toBe(true);
    const parsed = parseExportEnvelope(
      [
        "#casino-lord v3 game=roulette table=TEST01 series=1 started=2026-01-01T00:00:00.000Z source=virtual rules=eyJ3aGVlbCI6ImRyYWdvbiJ9",
        "#players",
        "#bets",
        `r1 p1 ${encoded} 50 win 100`,
      ].join("\n"),
    );
    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.bets[0]?.target).toEqual({ kind: "straight", pocket: 17 });
  });

  it("slices events for series boundaries", () => {
    const events = [
      ev(1, "2026-01-01T00:00:01.000Z", {
        type: "TABLE_CREATED",
        game: "baccarat",
        participation: houseSettings().participation,
        settings: houseSettings(),
      }),
      ev(2, "2026-01-01T00:00:02.000Z", { type: "SERIES_STARTED", seriesId: "s1" }),
      ev(3, "2026-01-01T00:00:03.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("r1", 0, 10),
      }),
      ev(4, "2026-01-01T00:00:04.000Z", { type: "SERIES_STARTED", seriesId: "s2" }),
      ev(5, "2026-01-01T00:00:05.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("r2", 0, 20),
      }),
    ];
    expect(sliceEventsForSeries(events, 1)).toHaveLength(2);
    expect(sliceEventsForSeries(events, 2)).toHaveLength(2);
    expect(prefixEventsThroughSeries(events, 1)).toHaveLength(3);
  });
});
