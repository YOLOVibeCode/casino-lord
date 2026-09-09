/**
 * @vitest-environment jsdom
 */
import type { Emit, TableMeta } from "@casino-lord/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reduce } from "../reducer.js";
import { DEFAULT_BACCARAT_RULES } from "../rules.js";
import { initialState } from "../state.js";
import { DealerView } from "./DealerView.js";

const TABLE: TableMeta = {
  code: "TEST01",
  game: "baccarat",
  outcomeSource: "physical",
  participation: { playerMode: "off", virtualOutcomes: false },
  createdAt: "2026-01-01T00:00:00.000Z",
};

function pickExpress(rank: string, suit: string) {
  fireEvent.click(screen.getByTestId(`suit-${suit}`));
  fireEvent.click(screen.getByTestId(`rank-${rank}`));
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
});
