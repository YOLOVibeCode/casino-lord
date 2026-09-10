/**
 * @vitest-environment jsdom
 */
import type { Emit, TableMeta } from "@casino-lord/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CRAPS_RULES } from "../rules.js";
import { initialState } from "../state.js";
import type { Face } from "../types.js";
import { DealerView } from "./DealerView.js";

const TABLE: TableMeta = {
  code: "TEST01",
  game: "craps",
  outcomeSource: "physical",
  participation: { playerMode: "off", virtualOutcomes: false },
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("DealerView", () => {
  afterEach(() => cleanup());

  it("emits LIVE_INPUT when die faces are tapped", () => {
    let state = initialState();
    const emit = vi.fn((event: { type: string; payload: { a: Face | null; b: Face | null } }) => {
      if (event.type !== "LIVE_INPUT") return;
      state = {
        ...state,
        liveInput: event.payload,
      };
    }) as Emit;
    const { rerender } = render(
      <DealerView
        state={state}
        rules={DEFAULT_CRAPS_RULES}
        table={TABLE}
        emit={emit}
        record={vi.fn()}
        expressMode={false}
      />,
    );
    fireEvent.click(screen.getByTestId("die-a-4"));
    rerender(
      <DealerView
        state={state}
        rules={DEFAULT_CRAPS_RULES}
        table={TABLE}
        emit={emit}
        record={vi.fn()}
        expressMode={false}
      />,
    );
    fireEvent.click(screen.getByTestId("die-b-3"));
    expect(emit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "LIVE_INPUT",
        payload: { a: 4, b: 3 },
      }),
    );
  });

  it("shows shooter name in header when players prop provided", () => {
    const state = { ...initialState(), currentShooterId: "p1" };
    render(
      <DealerView
        state={state}
        rules={DEFAULT_CRAPS_RULES}
        table={TABLE}
        emit={vi.fn()}
        record={vi.fn()}
        players={[{ id: "p1", name: "Ana" }]}
      />,
    );
    expect(screen.getByTestId("dealer-shooter-name").textContent).toBe("Shooter: Ana");
  });

  it("seven-out chip records total 7", () => {
    const record = vi.fn();
    render(
      <DealerView
        state={initialState()}
        rules={DEFAULT_CRAPS_RULES}
        table={TABLE}
        emit={vi.fn()}
        record={record}
      />,
    );
    fireEvent.click(screen.getByTestId("seven-out-chip"));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ total: 7 }), { quick: true });
  });
});
