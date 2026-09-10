/**
 * @vitest-environment jsdom
 */
import type { Emit, Player, TableEvent, TableMeta } from "@casino-lord/core";
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

function renderDealer(
  emit: Emit,
  rules = DEFAULT_BLACKJACK_RULES,
  state = initialState(rules),
  extra: { events?: TableEvent[]; players?: Player[] } = {},
) {
  return render(
    <DealerView
      state={state}
      rules={rules}
      table={TABLE}
      emit={emit}
      record={vi.fn()}
      events={extra.events ?? []}
      players={extra.players ?? []}
    />,
  );
}

const SEATED_PLAYER: Player = {
  id: "p1",
  name: "Ana",
  color: "#f00",
  status: "active",
  joinedAt: "2026-01-01T00:00:00.000Z",
  seat: 3,
};

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

  it("shows physical intent badge on the active seat tab", () => {
    const emit = vi.fn();
    const rules = DEFAULT_BLACKJACK_RULES;
    const state = initialState(rules);
    const events: TableEvent[] = [
      {
        seq: 1,
        at: "2026-01-01T00:00:01.000Z",
        type: "PLAYER_ACTION",
        playerId: "p1",
        action: "hit",
        intent: true,
      },
    ];

    renderDealer(emit, rules, state, { events, players: [SEATED_PLAYER] });

    act(() => {
      fireEvent.click(screen.getByTestId("seat-tab-3"));
    });

    expect(screen.getByTestId("seat-intent-3").textContent).toBe("HIT");
  });

  it("clears intent badge after LIVE_INPUT adds a card to the seat", () => {
    const emit = vi.fn();
    const rules = DEFAULT_BLACKJACK_RULES;
    let state = initialState(rules);
    const events: TableEvent[] = [
      {
        seq: 1,
        at: "2026-01-01T00:00:01.000Z",
        type: "PLAYER_ACTION",
        playerId: "p1",
        action: "hit",
        intent: true,
      },
      {
        seq: 2,
        at: "2026-01-01T00:00:02.000Z",
        type: "LIVE_INPUT",
        payload: {
          dealer: [],
          seats: {
            3: [
              {
                cards: [c("9")],
                doubled: false,
                fromSplit: false,
                surrendered: false,
                outcome: null,
              },
            ],
          },
        },
        source: "dealer",
      },
    ];

    state = reduce(state, events[1]!, rules);

    renderDealer(emit, rules, state, { events, players: [SEATED_PLAYER] });

    act(() => {
      fireEvent.click(screen.getByTestId("seat-tab-3"));
    });

    expect(screen.queryByTestId("seat-intent-3")).toBeNull();
  });

  it("hides intent badge when dealer moves to another seat tab", () => {
    const emit = vi.fn();
    const rules = DEFAULT_BLACKJACK_RULES;
    const state = initialState(rules);
    const events: TableEvent[] = [
      {
        seq: 1,
        at: "2026-01-01T00:00:01.000Z",
        type: "PLAYER_ACTION",
        playerId: "p1",
        action: "stand",
        intent: true,
      },
    ];

    renderDealer(emit, rules, state, { events, players: [SEATED_PLAYER] });

    act(() => {
      fireEvent.click(screen.getByTestId("seat-tab-3"));
    });
    expect(screen.getByTestId("seat-intent-3")).toBeTruthy();

    act(() => {
      fireEvent.click(screen.getByTestId("seat-tab-2"));
    });
    expect(screen.queryByTestId("seat-intent-3")).toBeNull();
  });

  it("renders spec seat outcome chip labels and keyboard hints", () => {
    const emit = vi.fn();
    renderDealer(emit);

    expect(screen.getByTestId("outcome-chip-win").textContent).toBe("WIN");
    expect(screen.getByTestId("outcome-chip-lose").textContent).toBe("LOSE");
    expect(screen.getByTestId("outcome-chip-push").textContent).toBe("PUSH");
    expect(screen.getByTestId("outcome-chip-blackjack").textContent).toBe("BJ");
    expect(screen.getByTestId("outcome-chip-bust").textContent).toBe("BUST");
    expect(screen.getByTestId("outcome-chip-surrender").textContent).toBe("SURR");

    expect(screen.getByTestId("outcome-chip-win").getAttribute("title")).toBe("W");
    expect(screen.getByTestId("outcome-chip-lose").getAttribute("title")).toBe("L");
    expect(screen.getByTestId("outcome-chip-push").getAttribute("title")).toBe("P");
    expect(screen.getByTestId("outcome-chip-blackjack").getAttribute("title")).toBe("J");
    expect(screen.getByTestId("outcome-chip-bust").getAttribute("title")).toBe("B");
    expect(screen.getByTestId("outcome-chip-surrender").getAttribute("title")).toBe("R");
  });

  it("does not show intent badges on virtual tables", () => {
    const emit = vi.fn();
    const rules = DEFAULT_BLACKJACK_RULES;
    let state = initialState(rules);
    const live = {
      dealer: [c("7")],
      seats: {
        3: [
          {
            cards: [c("9"), c("7")],
            doubled: false,
            fromSplit: false,
            surrendered: false,
            outcome: null,
          },
        ],
      },
      virtual: {
        shoe: [],
        shoeIndex: 0,
        phase: "player" as const,
        activeSeats: [3 as const],
        currentSeat: 3 as const,
        currentHandIndex: 0,
        holeDealt: true,
        dealRound: 2,
        completedHands: [],
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
    const events: TableEvent[] = [
      {
        seq: 2,
        at: "2026-01-01T00:00:02.000Z",
        type: "PLAYER_ACTION",
        playerId: "p1",
        action: "hit",
        intent: true,
      },
    ];

    renderDealer(emit, rules, state, { events, players: [SEATED_PLAYER] });

    act(() => {
      fireEvent.click(screen.getByTestId("seat-tab-3"));
    });

    expect(screen.queryByTestId("seat-intent-3")).toBeNull();
  });
});
