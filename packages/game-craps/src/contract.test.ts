import { describeGameModuleContract } from "@casino-lord/core/testing";
import { DEFAULT_TABLE_SETTINGS, type TableEvent } from "@casino-lord/core";
import { crapsModule } from "./module.js";
import { DEFAULT_CRAPS_RULES } from "./rules.js";
import { normalizeResult } from "./engine.js";
import { initialState } from "./state.js";
import type { CrapsResult } from "./types.js";

function ev(seq: number, at: string, body: Record<string, unknown> & { type: string }): TableEvent {
  return { seq, at, ...body } as TableEvent;
}

function atIso(n: number): string {
  return `2026-01-01T00:00:${String(n).padStart(2, "0")}.000Z`;
}

function resultEnvelope(id: string, index: number, data: CrapsResult, roundId?: string) {
  return {
    id,
    index,
    recordedAt: atIso(index),
    quick: data.a === null && data.b === null,
    source: "physical" as const,
    by: "dealer" as const,
    data,
    ...(roundId !== undefined ? { roundId } : {}),
  };
}

const roll44 = normalizeResult({ a: 4, b: 4 });
const roll62 = normalizeResult({ a: 6, b: 2 });
const rollTotal = normalizeResult({ a: null, b: null, total: 7 });

const settings = {
  ...DEFAULT_TABLE_SETTINGS,
  participation: { playerMode: "on", bank: "house", outcomeSource: "physical" as const },
};

const replayEvents: TableEvent[] = [
  ev(1, atIso(1), {
    type: "TABLE_CREATED",
    game: "craps",
    participation: settings.participation,
    settings,
  }),
  ev(2, atIso(2), { type: "SERIES_STARTED", seriesId: "s1" }),
  ev(3, atIso(3), {
    type: "RESULT_RECORDED",
    result: resultEnvelope("c0", 0, roll44),
  }),
  ev(4, atIso(4), {
    type: "RESULT_RECORDED",
    result: resultEnvelope("c1", 1, roll62),
  }),
  ev(5, atIso(5), {
    type: "RESULT_RECORDED",
    result: resultEnvelope("c2", 2, rollTotal),
  }),
];

describeGameModuleContract(crapsModule, {
  validResults: [roll44, roll62, rollTotal],
  validLiveInputs: [
    { a: 4, b: 4 },
    { a: null, b: null },
  ],
  validBetTargets: [
    { kind: "point", value: 8 },
    { kind: "attach", line: "pass" },
  ],
  invalidResults: [{ a: 7, b: 2, total: 9, hard: false }],
  invalidLiveInputs: [{ a: 7, b: 2 }],
  invalidBetTargets: [{ kind: "point", value: 7 }],
  exportSeriesText: "4-4 6-2 5-3 8",
  replayEvents,
  reduceEvent: ev(1, atIso(1), {
    type: "RESULT_RECORDED",
    result: resultEnvelope("r0", 0, roll44),
  }),
  reduceState: initialState(),
  settleScenario: {
    bets: [
      {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "pass",
        amount: 100,
        declared: false,
        working: true,
        placedAt: atIso(1),
        originRoundId: "r1",
      },
    ],
    result: roll44,
    before: initialState(),
    after: initialState(),
  },
  virtualStep: {
    moduleState: initialState(),
    trigger: "roll",
    seed: new Uint8Array(32).fill(3),
    betsIsolationEvent: ev(99, atIso(99), {
      type: "BET_PLACED",
      bet: {
        id: "iso1",
        playerId: "p1",
        roundId: "r1",
        type: "pass",
        amount: 100,
        declared: false,
        working: true,
        placedAt: atIso(99),
        originRoundId: "r1",
      },
    }),
  },
});
