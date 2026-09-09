/**
 * @vitest-environment jsdom
 */
import type { Emit, TableMeta } from "@casino-lord/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blackjackConfirm } from "../confirm.js";
import { reduce } from "../reducer.js";
import { DEFAULT_BLACKJACK_RULES } from "../rules.js";
import { initialState } from "../state.js";
import type { Card } from "../types.js";
import { DealerView } from "./DealerView.js";

const TABLE: TableMeta = {
  code: "TEST01",
  game: "blackjack",
  seriesNumber: 1,
  resultIndex: 0,
  participation: { playerMode: "off", bank: "none", outcomeSource: "physical" },
  playerCount: 0,
};

function c(rank: Card["rank"], suit: Card["suit"] = "S"): Card {
  return { rank, suit };
}

function renderDealer(emit: Emit, rules = DEFAULT_BLACKJACK_RULES, state = initialState(rules)) {
  return render(
    <DealerView state={state} rules={rules} table={TABLE} emit={emit} record={vi.fn()} />,
  );
}

afterEach(() => cleanup());

describe("DealerView", () => {
  it("shows blocking dealer error banner and override enables confirm with dealerError", () => {
    const emit = vi.fn();
    const rules = { ...DEFAULT_BLACKJACK_RULES, entryDepth: "full" as const };
    let state = initialState(rules);

    const live = {
      dealer: [c("10"), c("7"), c("2")],
      seats: {
        1: [
          {
            cards: [c("10"), c("9")],
            doubled: false,
            fromSplit: false,
            surrendered: false,
            outcome: null,
          },
        ],
      },
    };

    state = reduce(
      state,
      {
        seq: 1,
        at: "2026-01-01T00:00:01.000Z",
        type: "LIVE_INPUT",
        payload: live,
        source: "dealer",
      },
      rules,
    );

    const { rerender } = renderDealer(emit, rules, state);

    expect(screen.getByTestId("dealer-error-banner")).toBeTruthy();
    expect(blackjackConfirm(state, rules)?.enabled).toBe(false);

    act(() => {
      fireEvent.click(screen.getByTestId("dealer-error-override"));
    });

    const lastCall = emit.mock.calls.at(-1)?.[0];
    expect(lastCall?.type).toBe("LIVE_INPUT");
    expect(lastCall?.payload.recordDespiteDealerError).toBe(true);

    state = reduce(
      state,
      {
        seq: 2,
        at: "2026-01-01T00:00:02.000Z",
        type: "LIVE_INPUT",
        payload: { ...live, recordDespiteDealerError: true },
        source: "dealer",
      },
      rules,
    );

    rerender(<DealerView state={state} rules={rules} table={TABLE} emit={emit} record={vi.fn()} />);

    const confirm = blackjackConfirm(state, rules);
    expect(confirm?.enabled).toBe(true);
    expect(confirm?.result?.dealerError).toBe(true);
    expect(screen.queryByTestId("dealer-error-banner")).toBeNull();
  });

  it("splits a pair into two hands on the active seat", () => {
    const emit = vi.fn();
    const rules = { ...DEFAULT_BLACKJACK_RULES, entryDepth: "full" as const };
    const live = {
      dealer: [c("10")],
      seats: {
        1: [
          {
            cards: [c("8"), c("8")],
            doubled: false,
            fromSplit: false,
            surrendered: false,
            outcome: null,
          },
        ],
      },
    };
    let state = reduce(
      initialState(rules),
      {
        seq: 1,
        at: "2026-01-01T00:00:01.000Z",
        type: "LIVE_INPUT",
        payload: live,
        source: "dealer",
      },
      rules,
    );

    renderDealer(emit, rules, state);

    act(() => {
      fireEvent.click(screen.getByTestId("action-split"));
    });

    const payload = emit.mock.calls.at(-1)?.[0]?.payload;
    expect(payload.seats[1]).toHaveLength(2);
    expect(payload.seats[1][0].cards).toHaveLength(1);
    expect(payload.seats[1][1].cards).toHaveLength(1);
    expect(payload.seats[1][1].fromSplit).toBe(true);
  });
});
