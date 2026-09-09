import type { PlayerState } from "@casino-lord/core";
import { describe, expect, it } from "vitest";
import {
  canDouble,
  canHit,
  canPlaceInsurance,
  canSplitHand,
  canStand,
  canSurrender,
  isActionEnabled,
  isMyTurn,
} from "./actions-enabled.js";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";
import { initialState } from "./state.js";
import type { Card, HandInput, VirtualSession } from "./types.js";

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

function me(seat: number): PlayerState {
  return {
    player: {
      id: "p1",
      name: "Ana",
      color: "#f00",
      status: "active",
      joinedAt: "2026-01-01T00:00:00.000Z",
      seat,
    },
    bankroll: 500,
    openBets: [],
  };
}

function playerTurnState(seat: number, playerHand: HandInput, virtual?: Partial<VirtualSession>) {
  const state = initialState();
  state.liveInput = {
    dealer: [card("7"), card("10")],
    seats: { [seat as 1]: [playerHand] },
    virtual: {
      shoe: [],
      shoeIndex: 0,
      phase: "player",
      activeSeats: [seat as 1],
      currentSeat: seat as 1,
      currentHandIndex: 0,
      holeDealt: true,
      dealRound: 2,
      completedHands: [],
      ...virtual,
    },
  };
  return state;
}

describe("actions-enabled", () => {
  it("enables hit and stand on my turn", () => {
    const state = playerTurnState(3, hand([card("9"), card("7")]));
    const player = me(3);
    expect(isMyTurn(state, player, DEFAULT_BLACKJACK_RULES)).toBe(true);
    expect(canHit(state, player, DEFAULT_BLACKJACK_RULES)).toBe(true);
    expect(canStand(state, player, DEFAULT_BLACKJACK_RULES)).toBe(true);
  });

  it("disables actions when not my seat", () => {
    const state = playerTurnState(3, hand([card("9"), card("7")]));
    expect(canHit(state, me(4), DEFAULT_BLACKJACK_RULES)).toBe(false);
  });

  it("allows double on two cards only", () => {
    const two = playerTurnState(3, hand([card("9"), card("2")]));
    expect(canDouble(two, me(3), DEFAULT_BLACKJACK_RULES)).toBe(true);
    const three = playerTurnState(3, hand([card("9"), card("2"), card("5")]));
    expect(canDouble(three, me(3), DEFAULT_BLACKJACK_RULES)).toBe(false);
  });

  it("allows split on a pair within maxSplits", () => {
    const state = playerTurnState(3, hand([card("8"), card("8")]));
    expect(canSplitHand(state, me(3), DEFAULT_BLACKJACK_RULES)).toBe(true);
  });

  it("allows surrender before action when rules permit", () => {
    const state = playerTurnState(3, hand([card("9"), card("7")]));
    expect(canSurrender(state, me(3), DEFAULT_BLACKJACK_RULES)).toBe(true);
    const noSurrender = { ...DEFAULT_BLACKJACK_RULES, surrender: "none" as const };
    expect(canSurrender(state, me(3), noSurrender)).toBe(false);
  });

  it("allows insurance during insurance window with dealer ace", () => {
    const state = initialState();
    state.liveInput = {
      dealer: [card("A")],
      seats: { 1: [hand([card("10"), card("9")])] },
      virtual: {
        shoe: [],
        shoeIndex: 0,
        phase: "insurance",
        activeSeats: [1],
        currentSeat: null,
        currentHandIndex: 0,
        holeDealt: true,
        dealRound: 2,
        completedHands: [],
      },
    };
    expect(canPlaceInsurance(state, DEFAULT_BLACKJACK_RULES)).toBe(true);
  });

  it("isActionEnabled mirrors per-action rules", () => {
    const state = playerTurnState(3, hand([card("8"), card("8")]));
    const player = me(3);
    expect(isActionEnabled("split", state, player, DEFAULT_BLACKJACK_RULES)).toBe(true);
    expect(isActionEnabled("double", state, player, DEFAULT_BLACKJACK_RULES)).toBe(true);
  });
});
