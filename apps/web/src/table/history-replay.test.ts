import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { baccaratModule, importText } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import type { BaccaratResult, BaccaratState } from "@casino-lord/game-baccarat";
import { stableStringify } from "@casino-lord/core";
import { asUntypedModule } from "./module-types.js";
import { createTableStore } from "./store.js";
import { findResultEnvelope } from "./result-envelopes.js";

const baccarat = asUntypedModule(baccaratModule);
const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/game-baccarat/fixtures",
);

describe("history edit replay", () => {
  it("edit hand 30 from B to P changes roads", () => {
    const text = readFileSync(join(fixtureDir, "shoe-60.txt"), "utf8");
    const imported = importText(text);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
      id: () => `id-${n}`,
    });

    store.importResults(imported.hands.map((h) => h.result));

    const beforeRoads = stableStringify(
      (store.getComposed().module as BaccaratState).roads.bigRoad,
    );

    const results = (store.getComposed().module as BaccaratState).results;
    const hand30 = results[30]!;
    const envelope = findResultEnvelope<BaccaratResult>(hand30.id, store.events);
    expect(envelope).not.toBeNull();

    const original = hand30.data;
    store.editResult({
      ...envelope!,
      data: {
        ...original,
        outcome: "P",
        playerTotal: original.playerTotal ?? 7,
        bankerTotal: original.bankerTotal ?? 5,
      },
    });

    expect(store.events.some((e) => e.type === "RESULT_EDITED")).toBe(true);

    const afterRoads = stableStringify((store.getComposed().module as BaccaratState).roads.bigRoad);
    expect(afterRoads).not.toBe(beforeRoads);
    expect((store.getComposed().module as BaccaratState).results[30]!.data.outcome).toBe("P");
  });

  it("delete appends RESULT_DELETED", () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
      id: () => `id-${n}`,
    });

    store.record(
      {
        cards: null,
        outcome: "B",
        playerTotal: null,
        bankerTotal: null,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );

    const id = (store.getComposed().module as BaccaratState).results[0]!.id;
    store.deleteResult(id);

    expect(store.events.some((e) => e.type === "RESULT_DELETED" && e.resultId === id)).toBe(true);
    expect((store.getComposed().module as BaccaratState).results).toHaveLength(0);
  });
});
