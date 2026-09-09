import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import type { BaccaratState } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "./module-types.js";
import { composedStateFingerprint, createTableStore, reopenTableStore } from "./store.js";

const baccarat = asUntypedModule(baccaratModule);

describe("table store", () => {
  it("creates table with TABLE_CREATED and SERIES_STARTED", () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "series-1",
    });

    expect(store.code).toHaveLength(6);
    expect(store.events.map((e) => e.type)).toEqual(["TABLE_CREATED", "SERIES_STARTED"]);
  });

  it("records results with physical dealer envelope fields", () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => `id-${n}`,
    });

    store.emit({
      type: "LIVE_INPUT",
      payload: {
        slots: {
          P1: { rank: "7", suit: "H" },
          B1: { rank: "4", suit: "H" },
          P2: { rank: "K", suit: "H" },
          B2: { rank: "5", suit: "H" },
        },
      },
      source: "dealer",
    });

    const confirm = baccaratModule.confirm(
      store.getComposed().module as BaccaratState,
      DEFAULT_BACCARAT_RULES,
    );
    expect(confirm?.enabled).toBe(true);
    store.record(confirm!.result!, { quick: false });

    const recorded = store.events.find((e) => e.type === "RESULT_RECORDED");
    expect(recorded?.type).toBe("RESULT_RECORDED");
    if (recorded?.type === "RESULT_RECORDED") {
      expect(recorded.result.source).toBe("physical");
      expect(recorded.result.by).toBe("dealer");
      expect(recorded.result.index).toBe(0);
    }
  });

  it("reopen reproduces byte-identical composed state", () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:1${++n}.000Z`,
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

    const before = composedStateFingerprint(store);
    const reopened = reopenTableStore({
      code: store.code,
      game: store.game,
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      events: [...store.events],
    });

    expect(composedStateFingerprint(reopened)).toBe(before);
  });

  it("getRules reflects SETTINGS_CHANGED patch", () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "series-1",
    });

    expect((store.getRules() as { predictionCells: boolean }).predictionCells).toBe(false);

    store.emit({
      type: "SETTINGS_CHANGED",
      patch: { rules: { predictionCells: true } },
    });

    expect((store.getRules() as { predictionCells: boolean }).predictionCells).toBe(true);
  });
});
