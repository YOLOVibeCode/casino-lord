import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { blackjackModule } from "@casino-lord/game-blackjack";
import { crapsModule, DEFAULT_CRAPS_RULES } from "@casino-lord/game-craps";
import { DEFAULT_ROULETTE_RULES, rouletteModule } from "@casino-lord/game-roulette";
import { getCurrentSeriesResults } from "@casino-lord/core";
import { asUntypedModule } from "./module-types.js";
import { createTableStore, type TableStore } from "./store.js";

function recordedEnvelopes(store: TableStore) {
  return store.events
    .filter((e) => e.type === "RESULT_RECORDED")
    .map((e) => (e.type === "RESULT_RECORDED" ? e.result : null))
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

function assertTwoResultsAndUndo(store: TableStore): void {
  expect(store.canUndoLastResult().ok).toBe(true);
  const envelopes = recordedEnvelopes(store);
  expect(envelopes.map((r) => r.index)).toEqual([0, 1]);
  expect(store.getTableMeta().resultIndex).toBe(3);

  store.undoLastResult();
  expect(getCurrentSeriesResults(store.getComposed().platform)).toHaveLength(1);
}

describe("platform result tracking", () => {
  it("baccarat tracks undo, indexes, and resultIndex", () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: asUntypedModule(baccaratModule),
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => `id-${n}`,
    });

    store.record(
      {
        cards: null,
        outcome: "B",
        playerTotal: 5,
        bankerTotal: 7,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );
    store.record(
      {
        cards: null,
        outcome: "P",
        playerTotal: 9,
        bankerTotal: 4,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );

    assertTwoResultsAndUndo(store);
  });

  it("roulette tracks undo, indexes, and resultIndex", () => {
    let n = 0;
    const store = createTableStore({
      game: "roulette",
      module: asUntypedModule(rouletteModule),
      rules: DEFAULT_ROULETTE_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => `id-${n}`,
    });

    store.record({ pocket: 1 }, { quick: true });
    store.record({ pocket: 17 }, { quick: true });

    assertTwoResultsAndUndo(store);
  });

  it("craps tracks undo, indexes, and resultIndex", () => {
    let n = 0;
    const store = createTableStore({
      game: "craps",
      module: asUntypedModule(crapsModule),
      rules: DEFAULT_CRAPS_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => `id-${n}`,
    });

    store.record({ a: 4, b: 4, total: 8, hard: null }, { quick: false });
    store.record({ a: 4, b: 3, total: 7, hard: null }, { quick: false });

    assertTwoResultsAndUndo(store);
  });

  it("blackjack tracks undo, indexes, and resultIndex", () => {
    let n = 0;
    const store = createTableStore({
      game: "blackjack",
      module: asUntypedModule(blackjackModule),
      rules: blackjackModule.defaultRules,
      rng: () => 0,
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => `id-${n}`,
    });

    const quickResult = {
      dealer: { cards: [], total: 21, bust: false, blackjack: true },
      seats: {},
      depth: "quick" as const,
      dealerError: false,
    };

    store.record(quickResult, { quick: true });
    store.record(
      {
        dealer: { cards: [], total: 20, bust: false, blackjack: false },
        seats: {},
        depth: "quick" as const,
        dealerError: false,
      },
      { quick: true },
    );

    assertTwoResultsAndUndo(store);
  });
});
