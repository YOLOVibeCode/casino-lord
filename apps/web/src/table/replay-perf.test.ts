import "fake-indexeddb/auto";
import { replay, type TableEvent } from "@casino-lord/core";
import { describe, expect, it } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { buildResultEnvelope } from "../betting/build-result-envelope.js";
import { asUntypedModule } from "./module-types.js";
import { createTableStore, reopenTableStore } from "./store.js";

const baccarat = asUntypedModule(baccaratModule);

function buildEventsWithResults(
  code: string,
  baseEvents: TableEvent[],
  count: number,
): TableEvent[] {
  const events = [...baseEvents];
  let seq = events[events.length - 1]!.seq;

  for (let i = 0; i < count; i++) {
    const composed = replay(events, baccarat, DEFAULT_BACCARAT_RULES, {
      code,
      includeEphemeral: true,
    });
    const envelope = buildResultEnvelope(
      composed,
      { outcome: i % 2 === 0 ? "P" : "B" },
      {
        id: `result-${i}`,
        now: `2026-01-01T00:01:${String(i).padStart(3, "0")}.000Z`,
        quick: true,
      },
    );
    seq += 1;
    events.push({
      seq,
      at: envelope.recordedAt,
      type: "RESULT_RECORDED",
      result: envelope,
    });
  }

  return events;
}

describe("replay performance", () => {
  it("replays 500 results and serves 10 getComposed calls under 50ms", () => {
    const seed = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "series-1",
    });

    const events = buildEventsWithResults(seed.code, [...seed.events], 500);
    const store = reopenTableStore({
      code: seed.code,
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      events,
    });

    store.getComposed();

    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      store.getComposed();
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  }, 60_000);
});
