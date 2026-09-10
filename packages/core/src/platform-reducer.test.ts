import { describe, expect, it } from "vitest";
import { replay } from "./replay.js";
import {
  createStubModule,
  ev,
  houseSettings,
  resultEnvelope,
  STUB_RULES,
} from "./testing/stub-module.js";
import { DEFAULT_TABLE_SETTINGS } from "./settings.js";
import { getChipsInPlay, getRoundBets } from "./betting-selectors.js";
import { getBankroll } from "./platform-state.js";

const module = createStubModule();

function baseEvents() {
  const settings = houseSettings();
  return [
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
  ];
}

describe("platform round state machine", () => {
  it("runs open → close → settle cycle with bankroll update", () => {
    const events = [
      ...baseEvents(),
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

    const state = replay(events, module, STUB_RULES, { code: "K7X2PQ" });
    expect(state.platform.rounds.find((r) => r.id === "r1")?.status).toBe("settled");
    expect(getBankroll(state.platform, "p1")).toBe(600);
    expect(state.platform.settlements.r1?.[0]?.outcome).toBe("win");
  });

  it("tracks RESULT_RECORDED without roundId without settling", () => {
    const events = [
      ...baseEvents(),
      ev(5, "2026-01-01T00:00:05.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("res1", 0, 15),
      }),
    ];

    const state = replay(events, module, STUB_RULES, { code: "K7X2PQ" });
    expect(Object.keys(state.platform.settlements)).toHaveLength(0);
    expect(getBankroll(state.platform, "p1")).toBe(500);
    expect(state.platform.results).toHaveLength(1);
    expect(state.platform.results[0]?.id).toBe("res1");
  });

  it("no-ops late BET_PLACED after close", () => {
    const events = [
      ...baseEvents(),
      ev(5, "2026-01-01T00:00:05.000Z", { type: "BETS_OPENED", roundId: "r1" }),
      ev(6, "2026-01-01T00:00:06.000Z", { type: "BETS_CLOSED", roundId: "r1", by: "dealer" }),
      ev(7, "2026-01-01T00:00:07.000Z", {
        type: "BET_PLACED",
        bet: {
          id: "b1",
          playerId: "p1",
          roundId: "r1",
          type: "high",
          amount: 100,
          declared: false,
          working: false,
          placedAt: "2026-01-01T00:00:07.000Z",
          originRoundId: "r1",
        },
      }),
    ];

    const state = replay(events, module, STUB_RULES, { code: "K7X2PQ" });
    expect(state.platform.bets).toHaveLength(0);
    expect(getBankroll(state.platform, "p1")).toBe(500);
  });

  it("records declared bets without bankroll change when bank is none", () => {
    const settings = {
      ...DEFAULT_TABLE_SETTINGS,
      participation: { playerMode: "on", bank: "none", outcomeSource: "physical" as const },
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
      ev(4, "2026-01-01T00:00:04.000Z", { type: "BETS_OPENED", roundId: "r1" }),
      ev(5, "2026-01-01T00:00:05.000Z", {
        type: "BET_PLACED",
        bet: {
          id: "b1",
          playerId: "p1",
          roundId: "r1",
          type: "high",
          amount: 100,
          declared: true,
          working: false,
          placedAt: "2026-01-01T00:00:05.000Z",
          originRoundId: "r1",
        },
      }),
    ];

    const state = replay(events, module, STUB_RULES, { code: "K7X2PQ" });
    expect(state.platform.bets).toHaveLength(1);
    expect(getBankroll(state.platform, "p1")).toBe(0);
  });

  it("carries working bets into the next round", () => {
    const events = [
      ...baseEvents(),
      ev(5, "2026-01-01T00:00:05.000Z", { type: "BETS_OPENED", roundId: "r1" }),
      ev(6, "2026-01-01T00:00:06.000Z", {
        type: "BET_PLACED",
        bet: {
          id: "b1",
          playerId: "p1",
          roundId: "r1",
          type: "working",
          amount: 50,
          declared: false,
          working: true,
          placedAt: "2026-01-01T00:00:06.000Z",
          originRoundId: "r1",
        },
      }),
      ev(7, "2026-01-01T00:00:07.000Z", { type: "BETS_CLOSED", roundId: "r1", by: "dealer" }),
      ev(8, "2026-01-01T00:00:08.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("res1", 0, 10, "r1"),
      }),
      ev(9, "2026-01-01T00:00:09.000Z", { type: "BETS_OPENED", roundId: "r2" }),
    ];

    const state = replay(events, module, STUB_RULES, { code: "K7X2PQ" });
    const r2Bets = getRoundBets(state.platform, "r2");
    expect(r2Bets).toHaveLength(1);
    expect(r2Bets[0]?.type).toBe("working");
    expect(r2Bets[0]?.amount).toBe(50);
  });

  it("reverses settlement on RESULT_UNDONE", () => {
    const events = [
      ...baseEvents(),
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
      ev(9, "2026-01-01T00:00:09.000Z", { type: "RESULT_UNDONE", resultId: "res1" }),
    ];

    const state = replay(events, module, STUB_RULES, { code: "K7X2PQ" });
    expect(getBankroll(state.platform, "p1")).toBe(400);
    expect(state.platform.rounds.find((r) => r.id === "r1")?.status).toBe("closed");
    expect(state.platform.settlements.r1).toBeUndefined();
  });

  it("tracks current-series results independently of betting rounds", () => {
    const soloResult = (id: string, index: number, value: number) =>
      resultEnvelope(id, index, value);

    const events = [
      ...baseEvents(),
      ev(5, "2026-01-01T00:00:05.000Z", {
        type: "RESULT_RECORDED",
        result: soloResult("res1", 0, 15),
      }),
      ev(6, "2026-01-01T00:00:06.000Z", {
        type: "RESULT_RECORDED",
        result: soloResult("res2", 1, 20),
      }),
      ev(7, "2026-01-01T00:00:07.000Z", { type: "RESULT_UNDONE", resultId: "res2" }),
      ev(8, "2026-01-01T00:00:08.000Z", {
        type: "RESULT_EDITED",
        result: { ...soloResult("res1", 0, 15), data: { value: 12 } },
      }),
      ev(9, "2026-01-01T00:00:09.000Z", { type: "RESULT_DELETED", resultId: "res1" }),
      ev(10, "2026-01-01T00:00:10.000Z", {
        type: "RESULT_RECORDED",
        result: soloResult("res3", 0, 7),
      }),
      ev(11, "2026-01-01T00:00:11.000Z", { type: "SERIES_STARTED", seriesId: "s2" }),
    ];

    const afterTwo = replay(events.slice(0, 6), module, STUB_RULES, { code: "K7X2PQ" });
    expect(afterTwo.platform.results.map((r) => r.id)).toEqual(["res1", "res2"]);

    const afterUndo = replay(events.slice(0, 7), module, STUB_RULES, { code: "K7X2PQ" });
    expect(afterUndo.platform.results.map((r) => r.id)).toEqual(["res1"]);

    const afterEdit = replay(events.slice(0, 8), module, STUB_RULES, { code: "K7X2PQ" });
    expect(afterEdit.platform.results[0]?.data).toEqual({ value: 12 });

    const afterDelete = replay(events.slice(0, 9), module, STUB_RULES, { code: "K7X2PQ" });
    expect(afterDelete.platform.results).toEqual([]);

    const afterNewSeries = replay(events, module, STUB_RULES, { code: "K7X2PQ" });
    expect(afterNewSeries.platform.results).toEqual([]);
  });

  it("appends settled-round results to platform.results", () => {
    const events = [
      ...baseEvents(),
      ev(5, "2026-01-01T00:00:05.000Z", { type: "BETS_OPENED", roundId: "r1" }),
      ev(6, "2026-01-01T00:00:06.000Z", { type: "BETS_CLOSED", roundId: "r1", by: "dealer" }),
      ev(7, "2026-01-01T00:00:07.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("res1", 0, 15, "r1"),
      }),
    ];

    const state = replay(events, module, STUB_RULES, { code: "K7X2PQ" });
    expect(state.platform.results).toHaveLength(1);
    expect(state.platform.results[0]?.id).toBe("res1");
  });

  it("reconciles chips in play", () => {
    const events = [
      ...baseEvents(),
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
    ];

    const state = replay(events, module, STUB_RULES, { code: "K7X2PQ" });
    const chips = getChipsInPlay(state.platform);
    expect(chips.issued).toBe(500);
    expect(chips.inBankrolls + chips.onFelt).toBe(500);
  });
});
