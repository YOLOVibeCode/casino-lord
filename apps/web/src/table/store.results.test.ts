import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { baccaratModule, DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { rouletteModule, DEFAULT_ROULETTE_RULES } from "@casino-lord/game-roulette";
import { crapsModule, DEFAULT_CRAPS_RULES } from "@casino-lord/game-craps";
import { blackjackModule, DEFAULT_BLACKJACK_RULES } from "@casino-lord/game-blackjack";
import type { BlackjackResult } from "@casino-lord/game-blackjack";
import type { GameId } from "@casino-lord/core";
import { asUntypedModule } from "./module-types.js";
import { createTableStore, type TableStore } from "./store.js";

function assertTwoResultsUndoAndMeta(
  store: TableStore,
  recordResult: (store: TableStore, n: number) => void,
): void {
  recordResult(store, 1);
  recordResult(store, 2);

  expect(store.canUndoLastResult().ok).toBe(true);
  expect(store.getTableMeta().resultIndex).toBe(3);

  const recorded = store.events.filter((e) => e.type === "RESULT_RECORDED");
  expect(recorded).toHaveLength(2);
  const second = recorded[1];
  expect(second?.type).toBe("RESULT_RECORDED");
  if (second?.type === "RESULT_RECORDED") {
    expect(second.result.index).toBe(1);
  }

  store.undoLastResult();
  expect(store.getComposed().platform.results).toHaveLength(1);
  expect(store.canUndoLastResult().ok).toBe(true);
}

function makeStore(game: GameId, module: ReturnType<typeof asUntypedModule>, rules: unknown) {
  let n = 0;
  return createTableStore({
    game,
    module,
    rules,
    rng: () => 0,
    now: () => `2026-01-01T00:00:0${++n}.000Z`,
    id: () => `id-${++n}`,
  });
}

describe("platform result tracking via store", () => {
  it("baccarat: undo, indexes, and resultIndex", () => {
    const store = makeStore("baccarat", asUntypedModule(baccaratModule), DEFAULT_BACCARAT_RULES);
    assertTwoResultsUndoAndMeta(store, (s) => {
      s.record(
        {
          cards: null,
          playerTotal: 8,
          bankerTotal: 9,
          outcome: "B",
          playerPair: false,
          bankerPair: false,
          natural: false,
        },
        { quick: true },
      );
    });
  });

  it("roulette: undo, indexes, and resultIndex", () => {
    const store = makeStore("roulette", asUntypedModule(rouletteModule), DEFAULT_ROULETTE_RULES);
    assertTwoResultsUndoAndMeta(store, (s) => {
      s.record({ pocket: 17 }, { quick: false });
    });
  });

  it("craps: undo, indexes, and resultIndex", () => {
    const store = makeStore("craps", asUntypedModule(crapsModule), DEFAULT_CRAPS_RULES);
    assertTwoResultsUndoAndMeta(store, (s) => {
      s.record({ a: 4, b: 4, total: 8, hard: null }, { quick: false });
    });
  });

  it("blackjack: undo, indexes, and resultIndex", () => {
    const store = makeStore("blackjack", asUntypedModule(blackjackModule), DEFAULT_BLACKJACK_RULES);
    const quickBust: BlackjackResult = {
      dealer: { cards: [], total: 22, bust: true, blackjack: false },
      seats: {},
      depth: "quick",
      dealerError: false,
    };
    assertTwoResultsUndoAndMeta(store, (s) => {
      s.record(quickBust, { quick: true });
    });
  });
});
