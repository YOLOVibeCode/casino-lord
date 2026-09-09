/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "./module-types.js";

const baccarat = asUntypedModule(baccaratModule);
import { isPersistedEvent } from "@casino-lord/core";
import { loadTable, saveTableEvents } from "./persistence.js";
import { composedStateFingerprint, createTableStore, reopenTableStore } from "./store.js";

describe("IndexedDB persistence", () => {
  beforeEach(async () => {
    indexedDB = new IDBFactory();
  });

  it("reopen reproduces byte-identical state", async () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:2${++n}.000Z`,
      id: () => `id-${n}`,
    });

    store.emit({
      type: "LIVE_INPUT",
      payload: { slots: { P1: { rank: "7", suit: "H" } } },
      source: "dealer",
    });

    store.record(
      {
        cards: null,
        outcome: "P",
        playerTotal: 7,
        bankerTotal: 5,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );

    await saveTableEvents(store.code, store.game, [...store.events]);
    const before = composedStateFingerprint(store);

    const loaded = await loadTable(store.code);
    expect(loaded).not.toBeNull();

    const reopened = reopenTableStore({
      code: store.code,
      game: store.game,
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      events: loaded!.events,
    });

    expect(composedStateFingerprint(reopened)).toBe(before);
  });

  it("does not persist ephemeral events", async () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:3${++n}.000Z`,
      id: () => `id-${n}`,
    });

    store.emit({
      type: "LIVE_INPUT",
      payload: { slots: { P1: { rank: "7", suit: "H" } } },
      source: "dealer",
    });

    store.emit({ type: "ANIMATION_PREVIEW", eventId: "preview-1" });

    await saveTableEvents(store.code, store.game, [...store.events]);
    const loaded = await loadTable(store.code);
    expect(loaded!.events.some((e) => !isPersistedEvent(e))).toBe(false);
    expect(loaded!.events.some((e) => e.type === "LIVE_INPUT")).toBe(false);
    expect(loaded!.events.some((e) => e.type === "ANIMATION_PREVIEW")).toBe(false);
  });
});
