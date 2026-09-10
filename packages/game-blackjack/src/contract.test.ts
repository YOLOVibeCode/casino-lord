import { describeGameModuleContract } from "@casino-lord/core/testing";
import { DEFAULT_TABLE_SETTINGS, hexToBytes, type TableEvent } from "@casino-lord/core";
import { blackjackModule } from "./module.js";
import { parseQuickDealerToken } from "./quick-entry.js";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";
import { initialState } from "./state.js";
import type { BlackjackResult, Card } from "./types.js";

function ev(seq: number, at: string, body: Record<string, unknown> & { type: string }): TableEvent {
  return { seq, at, ...body } as TableEvent;
}

function atIso(n: number): string {
  return `2026-01-01T00:00:${String(n).padStart(2, "0")}.000Z`;
}

function c(rank: Card["rank"], suit: Card["suit"] = "S"): Card {
  return { rank, suit };
}

const outcomesResult: BlackjackResult = {
  dealer: { cards: [], total: 20, bust: false, blackjack: false },
  seats: {
    1: [
      {
        cards: [],
        doubled: false,
        fromSplit: false,
        surrendered: false,
        outcome: "win",
      },
    ],
  },
  depth: "outcomes",
  dealerError: false,
};

const quickResult = parseQuickDealerToken("BUST")!;

const settings = {
  ...DEFAULT_TABLE_SETTINGS,
  participation: { playerMode: "on", bank: "house", outcomeSource: "physical" as const },
};

const replayEvents: TableEvent[] = [
  ev(1, atIso(1), {
    type: "TABLE_CREATED",
    game: "blackjack",
    participation: settings.participation,
    settings,
  }),
  ev(2, atIso(2), { type: "SERIES_STARTED", seriesId: "s1" }),
  ev(3, atIso(3), {
    type: "RESULT_RECORDED",
    result: {
      id: "bj0",
      index: 0,
      recordedAt: atIso(3),
      quick: true,
      source: "physical",
      by: "dealer",
      data: quickResult,
    },
  }),
  ev(4, atIso(4), {
    type: "RESULT_RECORDED",
    result: {
      id: "bj1",
      index: 1,
      recordedAt: atIso(4),
      quick: false,
      source: "physical",
      by: "dealer",
      data: outcomesResult,
    },
  }),
];

describeGameModuleContract(blackjackModule, {
  validResults: [quickResult, parseQuickDealerToken("BJ")!, parseQuickDealerToken("20")!],
  validLiveInputs: [{ dealer: [c("7")], seats: {}, recordDespiteDealerError: false }],
  validBetTargets: [{ seat: 1 }, { seat: 2, handIndex: 0 }],
  invalidResults: [{ depth: "invalid", dealer: { cards: "x" }, seats: {}, dealerError: false }],
  invalidLiveInputs: [{ dealer: "not-cards" }],
  invalidBetTargets: [{ seat: 9 }],
  exportSeriesText: "D:7S,KD,4H | 1:L | 2:L | 5:BJ\nD:BUST",
  replayEvents,
  reduceEvent: ev(1, atIso(1), {
    type: "RESULT_RECORDED",
    result: {
      id: "r0",
      index: 0,
      recordedAt: atIso(1),
      quick: true,
      source: "physical",
      by: "dealer",
      data: quickResult,
    },
  }),
  reduceState: initialState(),
  settleScenario: {
    bets: [
      {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "main",
        target: { seat: 1 },
        amount: 100,
        declared: false,
        working: false,
        placedAt: atIso(1),
        originRoundId: "r1",
      },
    ],
    result: outcomesResult,
    before: initialState(),
    after: initialState(),
  },
  virtualStep: {
    moduleState: initialState(),
    trigger: "deal",
    seed: hexToBytes("010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
    betsIsolationEvent: ev(99, atIso(99), {
      type: "BET_PLACED",
      bet: {
        id: "iso1",
        playerId: "p1",
        roundId: "r1",
        type: "main",
        target: { seat: 1 },
        amount: 100,
        declared: false,
        working: false,
        placedAt: atIso(99),
        originRoundId: "r1",
      },
    }),
  },
});
