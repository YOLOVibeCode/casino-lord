import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeGameModuleContract } from "@casino-lord/core/testing";
import { DEFAULT_TABLE_SETTINGS, hexToBytes, type TableEvent } from "@casino-lord/core";
import { baccaratModule } from "./module.js";
import { DEFAULT_BACCARAT_RULES } from "./rules.js";
import { importText } from "./serialize.js";
import { initialState } from "./state.js";
import type { BaccaratResult } from "./types.js";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function ev(seq: number, at: string, body: Record<string, unknown> & { type: string }): TableEvent {
  return { seq, at, ...body } as TableEvent;
}

function atIso(n: number): string {
  return `2026-01-01T00:00:${String(n).padStart(2, "0")}.000Z`;
}

function resultEnvelope(id: string, index: number, data: BaccaratResult) {
  return {
    id,
    index,
    recordedAt: atIso(index),
    quick: data.cards === null,
    source: "physical" as const,
    by: "dealer" as const,
    data,
  };
}

const sampleHand: BaccaratResult = {
  cards: null,
  outcome: "P",
  playerTotal: 7,
  bankerTotal: 5,
  playerPair: false,
  bankerPair: false,
  natural: false,
};

const tieHand: BaccaratResult = {
  cards: null,
  outcome: "T",
  playerTotal: 5,
  bankerTotal: 5,
  playerPair: false,
  bankerPair: false,
  natural: false,
};

const settings = {
  ...DEFAULT_TABLE_SETTINGS,
  participation: { playerMode: "on", bank: "house", outcomeSource: "physical" as const },
};

const replayEvents: TableEvent[] = [
  ev(1, atIso(1), {
    type: "TABLE_CREATED",
    game: "baccarat",
    participation: settings.participation,
    settings,
  }),
  ev(2, atIso(2), { type: "SERIES_STARTED", seriesId: "s1" }),
  ev(3, atIso(3), {
    type: "RESULT_RECORDED",
    result: resultEnvelope("h0", 0, sampleHand),
  }),
  ev(4, atIso(4), {
    type: "RESULT_RECORDED",
    result: resultEnvelope("h1", 1, tieHand),
  }),
  ev(5, atIso(5), {
    type: "RESULT_RECORDED",
    result: resultEnvelope("h2", 2, {
      ...sampleHand,
      outcome: "B",
      playerTotal: 4,
      bankerTotal: 8,
    }),
  }),
];

describeGameModuleContract(baccaratModule, {
  validResults: [sampleHand, tieHand],
  validLiveInputs: [{ slots: { P1: { rank: "7", suit: "H" } } }],
  validBetTargets: ["player", "banker", "tie"],
  invalidResults: [{ outcome: "X" }],
  invalidLiveInputs: [{ slots: { XX: { rank: "7", suit: "H" } } }],
  invalidBetTargets: ["invalid_bet"],
  exportSeriesText: "B P T Bb",
  replayEvents,
  reduceEvent: ev(1, atIso(1), {
    type: "RESULT_RECORDED",
    result: resultEnvelope("reduce", 0, sampleHand),
  }),
  reduceState: initialState(DEFAULT_BACCARAT_RULES),
  settleScenario: {
    bets: [
      {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "player",
        amount: 100,
        declared: false,
        working: false,
        placedAt: atIso(1),
        originRoundId: "r1",
      },
    ],
    result: sampleHand,
    before: initialState(DEFAULT_BACCARAT_RULES),
    after: initialState(DEFAULT_BACCARAT_RULES),
  },
  virtualStep: {
    moduleState: initialState(DEFAULT_BACCARAT_RULES),
    trigger: "deal",
    seed: hexToBytes("010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
    betsIsolationEvent: ev(99, atIso(99), {
      type: "BET_PLACED",
      bet: {
        id: "iso1",
        playerId: "p1",
        roundId: "r1",
        type: "player",
        amount: 100,
        declared: false,
        working: false,
        placedAt: atIso(99),
        originRoundId: "r1",
      },
    }),
  },
});

// Ensure import fixture used in export round-trip is valid standalone
import { describe, expect, it } from "vitest";

describe("baccarat contract fixtures", () => {
  it("shoe-60 header imports", () => {
    const text = readFileSync(join(fixtureDir, "shoe-60.txt"), "utf8");
    expect(importText(text.split("\n")[0] ?? text).ok).toBe(true);
  });
});
