import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertReplayDeterministic, type TableEvent } from "@casino-lord/core";
import { baccaratModule } from "./module.js";
import { DEFAULT_BACCARAT_RULES } from "./rules.js";
import { importText } from "./serialize.js";
import { reduce } from "./reducer.js";
import { initialState } from "./state.js";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function ev(seq: number, at: string, body: Record<string, unknown> & { type: string }): TableEvent {
  return { seq, at, ...body } as TableEvent;
}

function resultEnvelope(id: string, index: number, data: unknown) {
  return {
    id,
    index,
    recordedAt: atIso(index),
    quick: data !== null && typeof data === "object" && (data as { cards: unknown }).cards === null,
    source: "physical" as const,
    by: "dealer" as const,
    data,
  };
}

function atIso(n: number): string {
  return `2026-01-01T00:00:${String(n).padStart(2, "0")}.000Z`;
}

describe("baccaratModule", () => {
  it("has correct metadata and layout", () => {
    expect(baccaratModule.id).toBe("baccarat");
    expect(baccaratModule.seriesLabel).toBe("Shoe");
    expect(baccaratModule.resultLabel).toBe("Hand");
    expect(baccaratModule.layouts).toEqual([{ id: "classic", label: "Classic", aspect: "16:9" }]);
    expect(baccaratModule.animationEvents).toHaveLength(10);
  });

  it("returns same state reference for unrelated events", () => {
    const state = initialState();
    const next = reduce(
      state,
      ev(1, atIso(1), { type: "BETS_OPENED", roundId: "r1" }),
      DEFAULT_BACCARAT_RULES,
    );
    expect(next).toBe(state);
  });

  it("clears live input on RESULT_RECORDED", () => {
    let state = initialState();
    state = reduce(
      state,
      ev(1, atIso(1), {
        type: "LIVE_INPUT",
        payload: { slots: { P1: { rank: "7", suit: "H" } } },
        source: "dealer",
      }),
      DEFAULT_BACCARAT_RULES,
    );
    expect(Object.keys(state.liveSlots).length).toBeGreaterThan(0);

    state = reduce(
      state,
      ev(2, atIso(2), {
        type: "RESULT_RECORDED",
        result: resultEnvelope("h1", 0, {
          cards: null,
          outcome: "P",
          playerTotal: 7,
          bankerTotal: 5,
          playerPair: false,
          bankerPair: false,
          natural: false,
        }),
      }),
      DEFAULT_BACCARAT_RULES,
    );
    expect(state.liveSlots).toEqual({});
    expect(state.results).toHaveLength(1);
  });

  it("assertReplayDeterministic on 60-hand fixture with edit and delete", () => {
    const text = readFileSync(join(fixtureDir, "shoe-60.txt"), "utf8");
    const imported = importText(text);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const events: TableEvent[] = [ev(1, atIso(1), { type: "SERIES_STARTED", seriesId: "s1" })];

    imported.hands.forEach((hand, i) => {
      events.push(
        ev(i + 2, atIso(i + 2), {
          type: "RESULT_RECORDED",
          result: resultEnvelope(`h${i}`, i, hand.result),
        }),
      );
    });

    const editIdx = 25;
    const deleteIdx = 40;
    const editHand = imported.hands[editIdx]!;
    events.push(
      ev(62, atIso(62), {
        type: "RESULT_EDITED",
        result: resultEnvelope(`h${editIdx}`, editIdx, {
          ...editHand.result,
          outcome: "T",
          playerTotal: 5,
          bankerTotal: 5,
        }),
      }),
    );
    events.push(
      ev(63, atIso(63), {
        type: "RESULT_DELETED",
        resultId: `h${deleteIdx}`,
      }),
    );

    expect(() =>
      assertReplayDeterministic(events, baccaratModule, DEFAULT_BACCARAT_RULES),
    ).not.toThrow();

    let state = initialState();
    for (const event of events) {
      state = reduce(state, event, DEFAULT_BACCARAT_RULES);
    }
    expect(state.results).toHaveLength(59);
    expect(state.roads.bigRoad.cols).toBeGreaterThan(0);
  });

  it("importSeries returns error on invalid text", () => {
    const result = baccaratModule.importSeries("NOT_VALID!!!", DEFAULT_BACCARAT_RULES);
    expect("error" in result).toBe(true);
  });
});
