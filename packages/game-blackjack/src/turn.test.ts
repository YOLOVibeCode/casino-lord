import { describe, expect, it } from "vitest";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";
import { initialState } from "./state.js";
import type { Card, HandInput, VirtualSession } from "./types.js";
import {
  ACTION_TIMER_MS,
  blackjackTurn,
  findPendingTurn,
  getPendingTurn,
  isHandComplete,
  TURN_PROMPT,
} from "./turn.js";

function card(rank: Card["rank"], suit: Card["suit"] = "S"): Card {
  return { rank, suit };
}

function hand(cards: Card[], overrides: Partial<HandInput> = {}): HandInput {
  return {
    cards,
    doubled: false,
    fromSplit: false,
    surrendered: false,
    outcome: null,
    ...overrides,
  };
}

function virtualSession(overrides: Partial<VirtualSession> = {}): VirtualSession {
  return {
    shoe: [],
    shoeIndex: 0,
    phase: "player",
    activeSeats: [1, 2],
    currentSeat: 1,
    currentHandIndex: 0,
    holeDealt: true,
    dealRound: 2,
    completedHands: [],
    ...overrides,
  };
}

describe("turn", () => {
  it("returns null when idle", () => {
    expect(blackjackTurn(initialState(), DEFAULT_BLACKJACK_RULES)).toBeNull();
  });

  it("returns null during insurance phase", () => {
    const state = initialState();
    state.liveInput = {
      dealer: [card("A")],
      seats: { 1: [hand([card("10"), card("9")])] },
      virtual: virtualSession({ phase: "insurance", currentSeat: null }),
    };
    expect(getPendingTurn(state, DEFAULT_BLACKJACK_RULES)).toBeNull();
  });

  it("skips natural blackjack hands in seat order", () => {
    const seats = {
      1: [hand([card("A"), card("K")])],
      2: [hand([card("9"), card("7")])],
    };
    const pending = findPendingTurn(seats, [1, 2], DEFAULT_BLACKJACK_RULES);
    expect(pending).toEqual({ seat: 2, handIndex: 0 });
  });

  it("sequences split hands before next seat", () => {
    const seats = {
      1: [hand([card("8"), card("8")]), hand([card("10"), card("5")], { fromSplit: true })],
    };
    const pending = findPendingTurn(seats, [1], DEFAULT_BLACKJACK_RULES, ["1:0"]);
    expect(pending).toEqual({ seat: 1, handIndex: 1 });
  });

  it("returns turn info with prompt and deadline", () => {
    const startedAt = "2026-01-01T00:00:00.000Z";
    const state = initialState();
    state.liveInput = {
      dealer: [card("7"), card("3")],
      seats: { 1: [hand([card("9"), card("7")])] },
      virtual: virtualSession({
        turnStartedAt: startedAt,
        activeSeats: [1],
      }),
    };
    const turn = blackjackTurn(state, DEFAULT_BLACKJACK_RULES);
    expect(turn?.prompt).toBe(TURN_PROMPT);
    expect(turn?.playerId).toBeNull();
    expect(turn?.deadlineMs).toBe(Date.parse(startedAt) + ACTION_TIMER_MS);
  });

  it("detects physical pending seat without virtual session", () => {
    const state = initialState();
    state.liveInput = {
      dealer: [card("7")],
      seats: {
        1: [hand([card("10"), card("6")])],
        2: [hand([card("A"), card("K")])],
      },
    };
    expect(getPendingTurn(state, DEFAULT_BLACKJACK_RULES)).toEqual({
      seat: 1,
      handIndex: 0,
    });
  });

  it("isHandComplete treats doubled three-card hand as done", () => {
    const h = hand([card("5"), card("6"), card("10")], { doubled: true });
    expect(isHandComplete(h, 1, 0, DEFAULT_BLACKJACK_RULES)).toBe(true);
  });
});
