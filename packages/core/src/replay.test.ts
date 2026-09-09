import { describe, expect, it } from "vitest";
import { replay, stableStringify, assertReplayDeterministic } from "./replay.js";
import {
  createStubModule,
  ev,
  houseSettings,
  resultEnvelope,
  STUB_RULES,
} from "./testing/stub-module.js";
import { DEFAULT_TABLE_SETTINGS } from "./settings.js";

describe("replay determinism", () => {
  it("replays a fixture log twice to byte-identical composed state", () => {
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
        seriesId: "s1",
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
        type: "RESULT_RECORDED",
        result: resultEnvelope("res2", 1, 5),
      }),
    ];

    expect(() =>
      assertReplayDeterministic(events, module, STUB_RULES, { code: "K7X2PQ" }),
    ).not.toThrow();

    const first = stableStringify(replay(events, module, STUB_RULES, { code: "K7X2PQ" }));
    const second = stableStringify(replay(events, module, STUB_RULES, { code: "K7X2PQ" }));
    expect(first).toBe(second);

    const state = replay(events, module, STUB_RULES, { code: "K7X2PQ" });
    expect(state.module.results).toEqual([
      { id: "res1", value: 15 },
      { id: "res2", value: 5 },
    ]);
    expect(state.module.sum).toBe(20);
    expect(state.module.appliedThreshold).toBe(10);
    expect(state.platform.bankrolls.p1).toBe(600);
  });
});

describe("RESULT_EDITED recompute", () => {
  it("recomputes module series and bankroll after editing a settled result", () => {
    const module = createStubModule();
    const settings = houseSettings();
    const base = [
      ev(1, "2026-01-01T00:00:01.000Z", {
        type: "TABLE_CREATED",
        game: "baccarat",
        participation: settings.participation,
        settings,
      }),
      ev(2, "2026-01-01T00:00:02.000Z", { type: "SERIES_STARTED", seriesId: "s1" }),
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
      ev(5, "2026-01-01T00:00:05.000Z", { type: "BETS_OPENED", roundId: "r1" }),
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
      ev(7, "2026-01-01T00:00:07.000Z", { type: "BETS_CLOSED", roundId: "r1", by: "dealer" }),
      ev(8, "2026-01-01T00:00:08.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("res1", 0, 15, "r1"),
      }),
    ];

    const beforeEdit = replay(base, module, STUB_RULES);
    expect(beforeEdit.platform.bankrolls.p1).toBe(600);

    const edited = [
      ...base,
      ev(9, "2026-01-01T00:00:09.000Z", {
        type: "RESULT_EDITED",
        result: resultEnvelope("res1", 0, 5, "r1"),
      }),
    ];

    const afterEdit = replay(edited, module, STUB_RULES);
    expect(afterEdit.module.results).toEqual([{ id: "res1", value: 5 }]);
    expect(afterEdit.module.sum).toBe(5);
    expect(afterEdit.module.appliedThreshold).toBe(10);
    expect(afterEdit.platform.bankrolls.p1).toBe(400);
  });
});

describe("RESULT_DELETED recompute", () => {
  it("recomputes module series and removes settlement when a result is deleted", () => {
    const module = createStubModule();
    const settings = {
      ...DEFAULT_TABLE_SETTINGS,
      participation: { playerMode: "on", bank: "house", outcomeSource: "physical" as const },
    };

    const events = [
      ev(1, "2026-01-01T00:00:01.000Z", {
        type: "TABLE_CREATED",
        game: "baccarat",
        participation: settings.participation,
        settings,
      }),
      ev(2, "2026-01-01T00:00:02.000Z", { type: "SERIES_STARTED", seriesId: "s1" }),
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
      ev(5, "2026-01-01T00:00:05.000Z", { type: "BETS_OPENED", roundId: "r1" }),
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
      ev(7, "2026-01-01T00:00:07.000Z", { type: "BETS_CLOSED", roundId: "r1", by: "dealer" }),
      ev(8, "2026-01-01T00:00:08.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("res1", 0, 15, "r1"),
      }),
      ev(9, "2026-01-01T00:00:09.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("res2", 1, 20),
      }),
      ev(10, "2026-01-01T00:00:10.000Z", {
        type: "RESULT_DELETED",
        resultId: "res1",
      }),
    ];

    const state = replay(events, module, STUB_RULES);
    expect(state.module.results).toEqual([{ id: "res2", value: 20 }]);
    expect(state.module.sum).toBe(20);
    expect(state.module.appliedThreshold).toBe(10);
    expect(state.platform.settlements.r1).toBeUndefined();
    expect(state.platform.bankrolls.p1).toBe(400);
  });
});

describe("SETTINGS_CHANGED rules-in-force", () => {
  it("replays byte-identically with mid-series threshold change", () => {
    const module = createStubModule();
    const settings = {
      ...DEFAULT_TABLE_SETTINGS,
      rules: STUB_RULES,
    };
    const events = [
      ev(1, "2026-01-01T00:00:01.000Z", {
        type: "TABLE_CREATED",
        game: "baccarat",
        participation: settings.participation,
        settings,
      }),
      ev(2, "2026-01-01T00:00:02.000Z", { type: "SERIES_STARTED", seriesId: "s1" }),
      ev(3, "2026-01-01T00:00:03.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("r0", 0, 5),
      }),
      ev(4, "2026-01-01T00:00:04.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("r1", 1, 8),
      }),
      ev(5, "2026-01-01T00:00:05.000Z", {
        type: "SETTINGS_CHANGED",
        patch: { rules: { threshold: 20 } },
      }),
      ev(6, "2026-01-01T00:00:06.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("r2", 2, 12),
      }),
    ];

    expect(() => assertReplayDeterministic(events, module, STUB_RULES)).not.toThrow();

    const state = replay(events, module, STUB_RULES);
    expect(state.module.appliedThreshold).toBe(20);
    expect(state.module.results).toHaveLength(3);
  });
});

describe("SETTINGS_CHANGED animations", () => {
  it("replays byte-identically with animation preset patch", () => {
    const module = createStubModule();
    const settings = {
      ...DEFAULT_TABLE_SETTINGS,
      rules: STUB_RULES,
    };
    const events = [
      ev(1, "2026-01-01T00:00:01.000Z", {
        type: "TABLE_CREATED",
        game: "baccarat",
        participation: settings.participation,
        settings,
      }),
      ev(2, "2026-01-01T00:00:02.000Z", { type: "SERIES_STARTED", seriesId: "s1" }),
      ev(3, "2026-01-01T00:00:03.000Z", {
        type: "SETTINGS_CHANGED",
        patch: {
          animations: {
            "game.player_win": {
              enabled: true,
              style: "banner",
              durationMs: 900,
              intensity: 2,
              text: "PLAYER WINS",
              sound: null,
              soundVolume: 0.5,
              blockBoardUpdate: false,
            },
          },
        },
      }),
      ev(4, "2026-01-01T00:00:04.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("r0", 0, 5),
      }),
    ];

    expect(() => assertReplayDeterministic(events, module, STUB_RULES)).not.toThrow();

    const state = replay(events, module, STUB_RULES);
    expect(state.platform.settings.animations?.["game.player_win"]?.style).toBe("banner");
  });
});
