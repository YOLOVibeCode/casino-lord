import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import type { StorageLike } from "../settings/storage.js";
import { asUntypedModule } from "./module-types.js";
import { saveTableEvents } from "./persistence.js";
import { composedStateFingerprint } from "./store.js";
import { createNewSoloTable, resolveSoloTableStore } from "./solo-table.js";
import { getLastSoloTableCode } from "./solo-table-memory.js";

const baccarat = asUntypedModule(baccaratModule);

function createMemoryStore(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe("solo table resolution", () => {
  let memoryStore: StorageLike;
  let n: number;

  beforeEach(() => {
    indexedDB = new IDBFactory();
    memoryStore = createMemoryStore();
    n = 0;
  });

  const baseOptions = () => ({
    game: "baccarat" as const,
    module: baccarat,
    rules: DEFAULT_BACCARAT_RULES,
    store: memoryStore,
    rng: () => 0,
    now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
    id: () => `id-${n}`,
  });

  it("reopens byte-identical state on reload", async () => {
    const store = await resolveSoloTableStore(baseOptions());

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

    const reloaded = await resolveSoloTableStore(baseOptions());
    expect(reloaded.code).toBe(store.code);
    expect(composedStateFingerprint(reloaded)).toBe(before);
  });

  it("creates a new table when the remembered log is missing", async () => {
    memoryStore.setItem("casino-lord:last-solo:baccarat", "GHOST1");

    const store = await resolveSoloTableStore(baseOptions());

    expect(store.code).not.toBe("GHOST1");
    expect(getLastSoloTableCode("baccarat", memoryStore)).toBe(store.code);
  });

  it("createNewSoloTable mints a fresh code and updates the remembered key", async () => {
    let roll = 0;
    const options = () => ({
      ...baseOptions(),
      rng: () => roll++,
    });

    const first = await resolveSoloTableStore(options());
    const second = await createNewSoloTable(options());

    expect(second.code).not.toBe(first.code);
    expect(getLastSoloTableCode("baccarat", memoryStore)).toBe(second.code);
  });
});
