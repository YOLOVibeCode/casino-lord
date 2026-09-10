import { describeGameModuleContract } from "@casino-lord/core/testing";
import { DEFAULT_TABLE_SETTINGS, hexToBytes, type TableEvent } from "@casino-lord/core";
import { rouletteModule } from "./module.js";
import { DEFAULT_ROULETTE_RULES } from "./rules.js";
import { initialState } from "./state.js";
import type { RouletteResult } from "./types.js";

function ev(seq: number, at: string, body: Record<string, unknown> & { type: string }): TableEvent {
  return { seq, at, ...body } as TableEvent;
}

function atIso(n: number): string {
  return `2026-01-01T00:00:${String(n).padStart(2, "0")}.000Z`;
}

function resultEnvelope(id: string, index: number, pocket: RouletteResult["pocket"]) {
  return {
    id,
    index,
    recordedAt: atIso(index),
    quick: false,
    source: "physical" as const,
    by: "dealer" as const,
    data: { pocket },
  };
}

const settings = {
  ...DEFAULT_TABLE_SETTINGS,
  participation: { playerMode: "on", bank: "house", outcomeSource: "physical" as const },
};

const replayEvents: TableEvent[] = [
  ev(1, atIso(1), {
    type: "TABLE_CREATED",
    game: "roulette",
    participation: settings.participation,
    settings,
  }),
  ev(2, atIso(2), { type: "SERIES_STARTED", seriesId: "s1" }),
  ev(3, atIso(3), {
    type: "RESULT_RECORDED",
    result: resultEnvelope("s0", 0, 17),
  }),
  ev(4, atIso(4), {
    type: "RESULT_RECORDED",
    result: resultEnvelope("s1", 1, 32),
  }),
  ev(5, atIso(5), {
    type: "RESULT_RECORDED",
    result: resultEnvelope("s2", 2, 0),
  }),
];

describeGameModuleContract(rouletteModule, {
  validResults: [{ pocket: 17 }, { pocket: 0 }, { pocket: "00" }],
  validLiveInputs: [{ pending: 17 }, { pending: null, spinning: true }],
  validBetTargets: [{ kind: "red" }, { kind: "straight", pocket: 17 }],
  invalidResults: [{ pocket: 99 }],
  invalidLiveInputs: [{ pending: "bad" }],
  invalidBetTargets: [{ kind: "not_a_bet" }],
  exportSeriesText: "17 32 0 5 22",
  replayEvents,
  reduceEvent: ev(1, atIso(1), {
    type: "RESULT_RECORDED",
    result: resultEnvelope("r0", 0, 5),
  }),
  reduceState: initialState(DEFAULT_ROULETTE_RULES),
  settleScenario: {
    bets: [
      {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "straight",
        target: { kind: "straight", pocket: 17 },
        amount: 100,
        declared: false,
        working: false,
        placedAt: atIso(1),
        originRoundId: "r1",
      },
    ],
    result: { pocket: 17 },
    before: initialState(DEFAULT_ROULETTE_RULES),
    after: initialState(DEFAULT_ROULETTE_RULES),
  },
  virtualStep: {
    moduleState: initialState(DEFAULT_ROULETTE_RULES),
    trigger: "spin",
    seed: hexToBytes("010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
    betsIsolationEvent: ev(99, atIso(99), {
      type: "BET_PLACED",
      bet: {
        id: "iso1",
        playerId: "p1",
        roundId: "r1",
        type: "red",
        amount: 100,
        declared: false,
        working: false,
        placedAt: atIso(99),
        originRoundId: "r1",
      },
    }),
  },
});
