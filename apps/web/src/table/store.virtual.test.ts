import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import type { BaccaratState } from "@casino-lord/game-baccarat";
import { hexToBytes, verifyCommit } from "@casino-lord/core";
import { asUntypedModule } from "./module-types.js";
import { loadVirtualState, saveTableEvents } from "./persistence.js";
import { createTableStore, reopenTableStore } from "./store.js";

const baccarat = asUntypedModule(baccaratModule);
const TEST_SEED = hexToBytes("010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20");

const virtualParticipation = {
  playerMode: "off" as const,
  bank: "none" as const,
  outcomeSource: "virtual" as const,
};

const virtualStoreOptions = {
  game: "baccarat" as const,
  module: baccarat,
  rules: DEFAULT_BACCARAT_RULES,
  participation: virtualParticipation,
  virtualSeed: TEST_SEED,
  rng: () => 0,
};

describe("virtual solo table store", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates virtual table with committed series", () => {
    const store = createTableStore({
      ...virtualStoreOptions,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "series-1",
    });

    const start = store.events.find((e) => e.type === "SERIES_STARTED");
    expect(start?.type).toBe("SERIES_STARTED");
    if (start?.type === "SERIES_STARTED") {
      expect(start.commit).toHaveLength(64);
      expect(verifyCommit(TEST_SEED, store.code, "series-1", start.commit!)).toBe(true);
    }
  });

  it("sendVirtual trigger appends paced LIVE_INPUT then virtual RESULT_RECORDED", async () => {
    let n = 0;
    const store = createTableStore({
      ...virtualStoreOptions,
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => "series-1",
    });

    store.sendVirtual("trigger");
    await vi.advanceTimersByTimeAsync(10_000);

    const types = store.events.map((e) => e.type);
    expect(types.filter((t) => t === "LIVE_INPUT").length).toBeGreaterThanOrEqual(4);
    const recorded = store.events.find((e) => e.type === "RESULT_RECORDED");
    expect(recorded?.type).toBe("RESULT_RECORDED");
    if (recorded?.type === "RESULT_RECORDED") {
      expect(recorded.result.source).toBe("virtual");
      expect(recorded.result.by).toBe("system");
    }
    expect(store.getVirtualStatus?.()?.awaiting).toBeDefined();
  });

  it("physical table rejects sendVirtual and record stays physical", async () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => `id-${n}`,
    });

    const before = store.events.length;
    store.sendVirtual("trigger");
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.events.length).toBe(before);

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
    store.record(confirm!.result!, { quick: false });

    const recorded = store.events.find((e) => e.type === "RESULT_RECORDED");
    if (recorded?.type === "RESULT_RECORDED") {
      expect(recorded.result.source).toBe("physical");
    }
  });

  it("virtual table blocks dealer LIVE_INPUT and record", () => {
    const store = createTableStore({
      ...virtualStoreOptions,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "series-1",
    });

    const before = store.events.length;
    store.emit({
      type: "LIVE_INPUT",
      payload: { slots: { P1: { rank: "7", suit: "H" } } },
      source: "dealer",
    });
    store.record({ outcome: "P" }, { quick: true });
    expect(store.events.length).toBe(before);
  });

  it("startNewSeries reveals seed and verifies commit", () => {
    let n = 0;
    const store = createTableStore({
      ...virtualStoreOptions,
      now: () => `2026-01-01T00:00:1${++n}.000Z`,
      id: () => "series-1",
    });

    const start = store.events.find((e) => e.type === "SERIES_STARTED");
    expect(start?.type).toBe("SERIES_STARTED");

    store.startNewSeries("Shoe 2", { auto: false });

    const ended = store.events.find((e) => e.type === "SERIES_ENDED");
    expect(ended?.type).toBe("SERIES_ENDED");
    if (ended?.type === "SERIES_ENDED" && start?.type === "SERIES_STARTED") {
      expect(ended.seriesId).toBe("series-1");
      expect(verifyCommit(hexToBytes(ended.seed), store.code, ended.seriesId, start.commit!)).toBe(
        true,
      );
    }
  });

  it("reopen restores virtual dealer state from persistence", async () => {
    let n = 0;
    const store = createTableStore({
      ...virtualStoreOptions,
      now: () => `2026-01-01T00:00:2${++n}.000Z`,
      id: () => "series-1",
    });

    store.sendVirtual("trigger");
    await vi.advanceTimersByTimeAsync(10_000);

    vi.useRealTimers();
    await saveTableEvents(store.code, store.game, [...store.events]);
    const savedVirtual = await loadVirtualState(store.code);
    expect(savedVirtual?.seedHex).toBeTruthy();
    vi.useFakeTimers();

    const reopened = reopenTableStore({
      code: store.code,
      game: store.game,
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      events: [...store.events],
      virtualState: savedVirtual,
      now: () => `2026-01-01T00:00:3${++n}.000Z`,
      id: () => `id-${n}`,
    });

    const before = reopened.events.length;
    reopened.sendVirtual("trigger");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(reopened.events.length).toBeGreaterThan(before);
  });
});
