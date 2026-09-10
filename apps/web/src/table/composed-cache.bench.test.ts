import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  applyEvent,
  DEFAULT_TABLE_SETTINGS,
  replay,
  tableCodeFrom,
  type TableEvent,
} from "@casino-lord/core";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { buildResultEnvelope } from "../betting/build-result-envelope.js";
import { asUntypedModule } from "./module-types.js";
import { reopenTableStore } from "./store.js";

const baccarat = asUntypedModule(baccaratModule);

const QUICK_RESULT = {
  cards: null,
  outcome: "P" as const,
  playerTotal: 8,
  bankerTotal: 5,
  playerPair: false,
  bankerPair: false,
  natural: true,
};

function seedStoreWithResults(count: number) {
  const code = tableCodeFrom(() => 0);
  const participation = DEFAULT_TABLE_SETTINGS.participation;
  const events: TableEvent[] = [
    {
      seq: 1,
      at: "2026-01-01T00:00:00.000Z",
      type: "TABLE_CREATED",
      game: "baccarat",
      participation,
      settings: { ...DEFAULT_TABLE_SETTINGS, participation, rules: DEFAULT_BACCARAT_RULES },
    },
    {
      seq: 2,
      at: "2026-01-01T00:00:00.000Z",
      type: "SERIES_STARTED",
      seriesId: "series-1",
      label: baccaratModule.seriesLabel,
    },
  ];
  let composed = applyEvent(
    {
      module: baccaratModule.initialState(DEFAULT_BACCARAT_RULES),
      platform: replay([], baccaratModule, DEFAULT_BACCARAT_RULES, { code }).platform,
    },
    events[0]!,
    baccaratModule,
    DEFAULT_BACCARAT_RULES,
  );
  composed = applyEvent(composed, events[1]!, baccaratModule, DEFAULT_BACCARAT_RULES);
  let seq = 2;

  for (let i = 0; i < count; i++) {
    seq += 1;
    const envelope = buildResultEnvelope(
      composed,
      {
        ...QUICK_RESULT,
        outcome: i % 2 === 0 ? "P" : "B",
        playerTotal: i % 2 === 0 ? 8 : 5,
        bankerTotal: i % 2 === 0 ? 5 : 8,
      },
      {
        id: `result-${i}`,
        now: `2026-01-01T00:01:${String(i).padStart(2, "0")}.000Z`,
        quick: true,
      },
    );
    const event = {
      seq,
      at: `2026-01-01T00:01:${String(i).padStart(2, "0")}.000Z`,
      type: "RESULT_RECORDED",
      result: envelope,
    } as TableEvent;
    events.push(event);
    composed = applyEvent(composed, event, baccaratModule, DEFAULT_BACCARAT_RULES);
  }

  return reopenTableStore({
    code,
    game: "baccarat",
    module: baccarat,
    rules: DEFAULT_BACCARAT_RULES,
    events,
  });
}

describe("composed cache performance", () => {
  it("replays 500 results and 10 getComposed calls in under 50 ms", () => {
    const store = seedStoreWithResults(500);

    const start = performance.now();
    let first = store.getComposed();
    for (let i = 0; i < 9; i++) {
      expect(store.getComposed()).toBe(first);
    }
    expect(performance.now() - start).toBeLessThan(50);

    store.record(
      {
        ...QUICK_RESULT,
        outcome: "T",
        playerTotal: 8,
        bankerTotal: 8,
      },
      { quick: true },
    );

    const incrementalStart = performance.now();
    first = store.getComposed();
    for (let i = 0; i < 9; i++) {
      expect(store.getComposed()).toBe(first);
    }
    expect(performance.now() - incrementalStart).toBeLessThan(50);
  });
});
