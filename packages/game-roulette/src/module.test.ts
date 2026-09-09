import { describe, expect, it } from "vitest";
import { assertReplayDeterministic, type TableEvent } from "@casino-lord/core";
import { rouletteModule } from "./module.js";
import { DEFAULT_ROULETTE_RULES } from "./rules.js";
import { reduce } from "./reducer.js";
import { initialState } from "./state.js";

function ev(seq: number, body: Record<string, unknown> & { type: string }): TableEvent {
  return {
    seq,
    at: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
    ...body,
  } as TableEvent;
}

function record(id: string, index: number, pocket: number | null): TableEvent {
  return ev(index + 1, {
    type: "RESULT_RECORDED",
    result: {
      id,
      index,
      recordedAt: `2026-01-01T00:00:${String(index).padStart(2, "0")}.000Z`,
      quick: pocket === null,
      source: "physical",
      by: "dealer",
      data: { pocket },
    },
  });
}

describe("rouletteModule", () => {
  it("has correct metadata and layouts", () => {
    expect(rouletteModule.id).toBe("roulette");
    expect(rouletteModule.seriesLabel).toBe("Session");
    expect(rouletteModule.resultLabel).toBe("Spin");
    expect(rouletteModule.layouts.map((l) => l.id)).toEqual([
      "classic",
      "results-focus",
      "wheel-focus",
      "portrait",
    ]);
    expect(rouletteModule.animationEvents).toHaveLength(9);
    expect(rouletteModule.virtual?.kind).toBe("wheel");
  });

  it("assertReplayDeterministic with edit and delete", () => {
    const events: TableEvent[] = [
      ev(1, { type: "SERIES_STARTED", seriesId: "s1" }),
      record("r0", 0, 17),
      record("r1", 1, 32),
      record("r2", 2, 0),
      ev(5, {
        type: "RESULT_EDITED",
        result: {
          id: "r1",
          index: 1,
          recordedAt: "2026-01-01T00:00:02.000Z",
          quick: false,
          source: "physical",
          by: "dealer",
          data: { pocket: 5 },
        },
      }),
      ev(6, { type: "RESULT_DELETED", resultId: "r2" }),
    ];
    expect(() =>
      assertReplayDeterministic(events, rouletteModule, DEFAULT_ROULETTE_RULES),
    ).not.toThrow();

    let state = initialState(DEFAULT_ROULETTE_RULES);
    for (const event of events) {
      state = reduce(state, event, DEFAULT_ROULETTE_RULES);
    }
    expect(state.spins).toHaveLength(2);
  });

  it("importSeries returns error on invalid pocket", () => {
    const result = rouletteModule.importSeries("00", DEFAULT_ROULETTE_RULES);
    expect("error" in result).toBe(true);
  });

  it("export/import round-trip via module", () => {
    const exported = rouletteModule.exportSeries(
      {
        id: "s1",
        number: 1,
        startedAt: "2026-01-01T00:00:00.000Z",
        results: [
          {
            id: "r1",
            index: 0,
            recordedAt: "2026-01-01T00:00:01.000Z",
            quick: false,
            source: "physical",
            by: "dealer",
            data: { pocket: 17 },
          },
        ],
        rounds: [],
      },
      DEFAULT_ROULETTE_RULES,
    );
    const imported = rouletteModule.importSeries(exported, DEFAULT_ROULETTE_RULES);
    expect("error" in imported).toBe(false);
    if ("error" in imported) return;
    expect(imported.results).toEqual([{ pocket: 17 }]);
  });
});
