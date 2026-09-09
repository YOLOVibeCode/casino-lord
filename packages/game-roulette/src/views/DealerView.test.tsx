/**
 * @vitest-environment jsdom
 */
import type { Emit, TableMeta } from "@casino-lord/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ROULETTE_RULES } from "../rules.js";
import { initialState } from "../state.js";
import { DealerView } from "./DealerView.js";

const TABLE: TableMeta = {
  code: "TEST01",
  game: "roulette",
  outcomeSource: "physical",
  participation: { playerMode: "off", virtualOutcomes: false },
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("DealerView", () => {
  afterEach(() => cleanup());

  it("emits LIVE_INPUT when a number is tapped", () => {
    const emit = vi.fn() as Emit;
    render(
      <DealerView
        state={initialState(DEFAULT_ROULETTE_RULES)}
        rules={DEFAULT_ROULETTE_RULES}
        table={TABLE}
        emit={emit}
        record={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("number-cell-17"));
    expect(emit).toHaveBeenCalledWith({
      type: "LIVE_INPUT",
      payload: { pending: 17 },
      source: "dealer",
    });
  });

  it("records no spin on chip tap", () => {
    const record = vi.fn();
    render(
      <DealerView
        state={initialState(DEFAULT_ROULETTE_RULES)}
        rules={DEFAULT_ROULETTE_RULES}
        table={TABLE}
        emit={vi.fn()}
        record={record}
      />,
    );

    fireEvent.click(screen.getByTestId("outcome-chip-no-spin"));
    expect(record).toHaveBeenCalledWith({ pocket: null }, { quick: true });
  });
});
