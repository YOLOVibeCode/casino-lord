import { describe, expect, it } from "vitest";
import { baccaratConfirm } from "./confirm.js";
import { DEFAULT_BACCARAT_RULES } from "./rules.js";
import { initialState } from "./state.js";
import { reduce } from "./reducer.js";
import type { TableEvent } from "@casino-lord/core";
import type { Rank } from "./types.js";

function ev(seq: number, at: string, body: Record<string, unknown> & { type: string }): TableEvent {
  return { seq, at, ...body } as TableEvent;
}

function card(rank: Rank, suit: "H" | "D" | "S" | "C" = "H") {
  return { rank, suit };
}

describe("baccaratConfirm", () => {
  it("returns null for incomplete hands", () => {
    const state = initialState();
    expect(baccaratConfirm(state, DEFAULT_BACCARAT_RULES)).toBeNull();
  });

  it("returns confirm state for a complete natural banker win", () => {
    let state = initialState();
    state = reduce(
      state,
      ev(1, "2026-01-01T00:00:01.000Z", {
        type: "LIVE_INPUT",
        payload: {
          slots: {
            P1: card("7"),
            B1: card("4"),
            P2: card("K"),
            B2: card("5"),
          },
        },
        source: "dealer",
      }),
      DEFAULT_BACCARAT_RULES,
    );

    const confirm = baccaratConfirm(state, DEFAULT_BACCARAT_RULES);
    expect(confirm).not.toBeNull();
    expect(confirm!.label).toBe("✓ CONFIRM BANKER 9");
    expect(confirm!.color).toBe("#E5322D");
    expect(confirm!.badges).toContain("NATURAL");
    expect(confirm!.enabled).toBe(true);
    expect(confirm!.result).toMatchObject({
      outcome: "B",
      playerTotal: 7,
      bankerTotal: 9,
      natural: true,
    });
  });

  it("includes pair badges", () => {
    let state = initialState();
    state = reduce(
      state,
      ev(1, "2026-01-01T00:00:01.000Z", {
        type: "LIVE_INPUT",
        payload: {
          slots: {
            P1: card("7"),
            B1: card("4"),
            P2: card("7"),
            B2: card("4"),
          },
        },
        source: "dealer",
      }),
      DEFAULT_BACCARAT_RULES,
    );

    const confirm = baccaratConfirm(state, DEFAULT_BACCARAT_RULES);
    expect(confirm).not.toBeNull();
    expect(confirm!.badges).toContain("P PAIR");
    expect(confirm!.badges).toContain("B PAIR");
  });

  it("returns null when hand has validation errors", () => {
    let state = initialState();
    state = reduce(
      state,
      ev(1, "2026-01-01T00:00:01.000Z", {
        type: "LIVE_INPUT",
        payload: {
          slots: {
            P1: card("7"),
            B1: card("4"),
            P2: card("K"),
            B2: card("5"),
            P3: card("2"),
          },
        },
        source: "dealer",
      }),
      DEFAULT_BACCARAT_RULES,
    );

    expect(baccaratConfirm(state, DEFAULT_BACCARAT_RULES)).toBeNull();
  });
});
