/**
 * @vitest-environment jsdom
 */
import type { Emit, TableMeta } from "@casino-lord/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reduce } from "../reducer.js";
import { DEFAULT_BACCARAT_RULES } from "../rules.js";
import { initialState } from "../state.js";
import type { BaccaratResult } from "../types.js";
import { DealerView } from "./DealerView.js";

const TABLE: TableMeta = {
  code: "TEST01",
  game: "baccarat",
  outcomeSource: "physical",
  participation: { playerMode: "off", virtualOutcomes: false },
  createdAt: "2026-01-01T00:00:00.000Z",
};

const COMPLETE_HAND: BaccaratResult = {
  cards: {
    P1: { rank: "7", suit: "H" },
    B1: { rank: "4", suit: "H" },
    P2: { rank: "K", suit: "H" },
    B2: { rank: "5", suit: "H" },
  },
  outcome: "B",
  playerTotal: 7,
  bankerTotal: 9,
  playerPair: false,
  bankerPair: false,
  natural: true,
};

function pickExpress(rank: string, suit: string) {
  fireEvent.click(screen.getByTestId(`suit-${suit}`));
  fireEvent.click(screen.getByTestId(`rank-${rank}`));
}

function resultEvent(id: string, index: number, data: BaccaratResult) {
  return {
    seq: index,
    at: `2026-01-01T00:00:${String(index).padStart(2, "0")}.000Z`,
    type: "RESULT_RECORDED" as const,
    result: {
      id,
      index,
      recordedAt: `2026-01-01T00:00:${String(index).padStart(2, "0")}.000Z`,
      quick: data.cards === null,
      source: "physical" as const,
      by: "dealer" as const,
      data,
    },
  };
}

describe("DealerView", () => {
  afterEach(() => cleanup());

  it("deals P 7♥ K♠ / B 4♦ 5♣ with natural 9 hint and LIVE_INPUT per slot", async () => {
    const emitSpy = vi.fn();
    let state = initialState();
    let seq = 0;

    const emit: Emit = (event) => {
      emitSpy(event);
      state = reduce(
        state,
        { ...event, seq: ++seq, at: `2026-01-01T00:00:0${seq}.000Z` },
        DEFAULT_BACCARAT_RULES,
      );
      rerender(
        <DealerView
          state={state}
          rules={DEFAULT_BACCARAT_RULES}
          table={TABLE}
          emit={emit}
          record={vi.fn()}
          autoAdvance
          expressMode
        />,
      );
    };

    const { rerender } = render(
      <DealerView
        state={state}
        rules={DEFAULT_BACCARAT_RULES}
        table={TABLE}
        emit={emit}
        record={vi.fn()}
        autoAdvance
        expressMode
      />,
    );

    fireEvent.click(screen.getByTestId("slot-P1"));
    pickExpress("7", "H");
    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());
    pickExpress("4", "D");
    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());
    pickExpress("K", "S");
    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());
    pickExpress("5", "C");

    expect(emitSpy).toHaveBeenCalledTimes(4);
    for (const call of emitSpy.mock.calls) {
      expect(call[0]).toMatchObject({ type: "LIVE_INPUT", source: "dealer" });
    }

    expect(screen.getByTestId("hand-hint").textContent).toBe("Banker NATURAL 9 — no more cards");
  });

  it("calls record with quick entry shape on P chip tap", () => {
    const record = vi.fn();
    render(
      <DealerView
        state={initialState()}
        rules={DEFAULT_BACCARAT_RULES}
        table={TABLE}
        emit={vi.fn()}
        record={record}
      />,
    );
    fireEvent.mouseDown(screen.getByTestId("outcome-chip-P"));
    fireEvent.mouseUp(screen.getByTestId("outcome-chip-P"));
    expect(record).toHaveBeenCalledWith(
      {
        cards: null,
        outcome: "P",
        playerTotal: null,
        bankerTotal: null,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );
  });

  it("exposes accessible names on slot buttons", () => {
    let state = initialState();
    const { rerender } = render(
      <DealerView
        state={state}
        rules={DEFAULT_BACCARAT_RULES}
        table={TABLE}
        emit={vi.fn()}
        record={vi.fn()}
      />,
    );

    expect(screen.getByTestId("slot-P1").getAttribute("aria-label")).toBe(
      "Player card 1, empty, next",
    );
    expect(screen.getByTestId("slot-B3").getAttribute("aria-label")).toBe(
      "Banker card 3, empty, not allowed by rules",
    );

    state = reduce(
      state,
      {
        seq: 1,
        at: "2026-01-01T00:00:01.000Z",
        type: "LIVE_INPUT",
        payload: {
          slots: {
            P1: { rank: "5", suit: "C" },
            B1: { rank: "4", suit: "D" },
          },
        },
        source: "dealer",
      },
      DEFAULT_BACCARAT_RULES,
    );
    rerender(
      <DealerView
        state={state}
        rules={DEFAULT_BACCARAT_RULES}
        table={TABLE}
        emit={vi.fn()}
        record={vi.fn()}
      />,
    );

    expect(screen.getByTestId("slot-B1").getAttribute("aria-label")).toBe(
      "Banker card 1, 4 of diamonds",
    );

    state = reduce(
      state,
      {
        seq: 2,
        at: "2026-01-01T00:00:02.000Z",
        type: "LIVE_INPUT",
        payload: {
          slots: {
            P1: { rank: "2", suit: "H" },
            B1: { rank: "3", suit: "D" },
            P2: { rank: "3", suit: "C" },
            B2: { rank: "2", suit: "S" },
          },
        },
        source: "dealer",
      },
      DEFAULT_BACCARAT_RULES,
    );
    rerender(
      <DealerView
        state={state}
        rules={DEFAULT_BACCARAT_RULES}
        table={TABLE}
        emit={vi.fn()}
        record={vi.fn()}
      />,
    );

    expect(screen.getByTestId("slot-P3").getAttribute("aria-label")).toContain("draw required");
  });

  it("records quick entry and closes picker when P chip is tapped with picker open", async () => {
    const record = vi.fn();
    render(
      <DealerView
        state={initialState()}
        rules={DEFAULT_BACCARAT_RULES}
        table={TABLE}
        emit={vi.fn()}
        record={record}
      />,
    );

    fireEvent.click(screen.getByTestId("slot-P1"));
    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());

    fireEvent.mouseDown(screen.getByTestId("outcome-chip-P"));
    fireEvent.mouseUp(screen.getByTestId("outcome-chip-P"));

    expect(record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "P" }), { quick: true });
    await waitFor(() => expect(screen.queryByTestId("card-picker")).toBeNull());
  });

  it("records quick entry on keyboard P when picker is open", async () => {
    const record = vi.fn();
    render(
      <DealerView
        state={initialState()}
        rules={DEFAULT_BACCARAT_RULES}
        table={TABLE}
        emit={vi.fn()}
        record={record}
      />,
    );

    fireEvent.click(screen.getByTestId("slot-P1"));
    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());

    fireEvent.keyDown(document, { key: "p" });

    expect(record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "P" }), { quick: true });
    await waitFor(() => expect(screen.queryByTestId("card-picker")).toBeNull());
  });

  it("opens picker on P1 after record when autoAdvance is on", async () => {
    let state = initialState();
    let resultIndex = 0;

    const record = vi.fn((_result: BaccaratResult) => {
      resultIndex += 1;
      state = reduce(
        state,
        resultEvent(`h${resultIndex}`, resultIndex, COMPLETE_HAND),
        DEFAULT_BACCARAT_RULES,
      );
      rerender(
        <DealerView
          state={state}
          rules={DEFAULT_BACCARAT_RULES}
          table={TABLE}
          emit={vi.fn()}
          record={record}
          autoAdvance
        />,
      );
    });

    const { rerender } = render(
      <DealerView
        state={state}
        rules={DEFAULT_BACCARAT_RULES}
        table={TABLE}
        emit={vi.fn()}
        record={record}
        autoAdvance
      />,
    );

    state = reduce(
      state,
      {
        seq: 1,
        at: "2026-01-01T00:00:01.000Z",
        type: "LIVE_INPUT",
        payload: { slots: COMPLETE_HAND.cards! },
        source: "dealer",
      },
      DEFAULT_BACCARAT_RULES,
    );
    rerender(
      <DealerView
        state={state}
        rules={DEFAULT_BACCARAT_RULES}
        table={TABLE}
        emit={vi.fn()}
        record={record}
        autoAdvance
      />,
    );

    record(COMPLETE_HAND, { quick: false });

    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());
    expect(screen.getByTestId("card-picker").getAttribute("aria-label")).toBe("Player · Card 1");
  });

  it("keeps picker closed after record when autoAdvance is off", async () => {
    let state = initialState();
    let resultIndex = 0;

    const record = vi.fn((_result: BaccaratResult) => {
      resultIndex += 1;
      state = reduce(
        state,
        resultEvent(`h${resultIndex}`, resultIndex, COMPLETE_HAND),
        DEFAULT_BACCARAT_RULES,
      );
      rerender(
        <DealerView
          state={state}
          rules={DEFAULT_BACCARAT_RULES}
          table={TABLE}
          emit={vi.fn()}
          record={record}
          autoAdvance={false}
        />,
      );
    });

    const { rerender } = render(
      <DealerView
        state={state}
        rules={DEFAULT_BACCARAT_RULES}
        table={TABLE}
        emit={vi.fn()}
        record={record}
        autoAdvance={false}
      />,
    );

    record(COMPLETE_HAND, { quick: false });

    await waitFor(() => expect(record).toHaveBeenCalled());
    expect(screen.queryByTestId("card-picker")).toBeNull();
  });

  it("opens picker on P1 after first quick-entry record when autoAdvance is on", async () => {
    let state = initialState();
    const quickResult: BaccaratResult = {
      cards: null,
      outcome: "P",
      playerTotal: null,
      bankerTotal: null,
      playerPair: false,
      bankerPair: false,
      natural: false,
    };

    const record = vi.fn((_result: BaccaratResult) => {
      state = reduce(state, resultEvent("h1", 1, quickResult), DEFAULT_BACCARAT_RULES);
      rerender(
        <DealerView
          state={state}
          rules={DEFAULT_BACCARAT_RULES}
          table={TABLE}
          emit={vi.fn()}
          record={record}
          autoAdvance
        />,
      );
    });

    const { rerender } = render(
      <DealerView
        state={state}
        rules={DEFAULT_BACCARAT_RULES}
        table={TABLE}
        emit={vi.fn()}
        record={record}
        autoAdvance
      />,
    );

    record(quickResult, { quick: true });

    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());
    expect(screen.getByTestId("card-picker").getAttribute("aria-label")).toBe("Player · Card 1");
  });
});
