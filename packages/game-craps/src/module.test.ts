import { describe, expect, it } from "vitest";
import { assertReplayDeterministic, replay, type TableEvent } from "@casino-lord/core";
import { crapsModule } from "./module.js";
import { DEFAULT_CRAPS_RULES } from "./rules.js";
import { reduce } from "./reducer.js";
import { initialState } from "./state.js";

function ev(seq: number, body: Record<string, unknown> & { type: string }): TableEvent {
  return {
    seq,
    at: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
    ...body,
  } as TableEvent;
}

describe("crapsModule", () => {
  it("has correct metadata and layouts", () => {
    expect(crapsModule.id).toBe("craps");
    expect(crapsModule.seriesLabel).toBe("Shooter");
    expect(crapsModule.resultLabel).toBe("Roll");
    expect(crapsModule.layouts.map((l) => l.id)).toEqual([
      "classic",
      "puck-focus",
      "history-focus",
      "portrait",
    ]);
    expect(crapsModule.animationEvents).toHaveLength(11);
  });

  it("returns same state reference for unrelated events", () => {
    const state = initialState();
    const next = reduce(state, ev(1, { type: "BETS_OPENED", roundId: "r1" }), DEFAULT_CRAPS_RULES);
    expect(next).toBe(state);
  });

  it("is replay deterministic", () => {
    const events: TableEvent[] = [
      ev(1, { type: "SERIES_STARTED", seriesId: "s1" }),
      ev(2, {
        type: "RESULT_RECORDED",
        result: {
          id: "r1",
          index: 0,
          recordedAt: "",
          quick: false,
          source: "physical",
          by: "dealer",
          data: { a: 4, b: 4, total: 8, hard: true },
        },
      }),
      ev(3, {
        type: "RESULT_RECORDED",
        result: {
          id: "r2",
          index: 1,
          recordedAt: "",
          quick: false,
          source: "physical",
          by: "dealer",
          data: { a: 4, b: 3, total: 7, hard: null },
        },
      }),
      ev(4, { type: "SERIES_STARTED", seriesId: "s2", auto: true }),
    ];

    expect(() => assertReplayDeterministic(events, crapsModule, DEFAULT_CRAPS_RULES)).not.toThrow();
    const state = replay(events, crapsModule, DEFAULT_CRAPS_RULES);
    expect(state.module.shooter.rollCount).toBe(0);
  });

  it("importSeries round-trips", () => {
    const imported = crapsModule.importSeries("4-4 7", DEFAULT_CRAPS_RULES);
    expect("results" in imported).toBe(true);
    if ("results" in imported) {
      expect(imported.results).toHaveLength(2);
    }
  });

  it("describeResult formats dice and total", () => {
    expect(
      crapsModule.describeResult?.({ a: 6, b: 1, total: 7, hard: null }, DEFAULT_CRAPS_RULES),
    ).toBe("6-1 — 7");
  });
});
