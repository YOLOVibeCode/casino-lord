/**
 * @vitest-environment jsdom
 */
import type { BettingRound, PlayerState } from "@casino-lord/core";
import { PlayerBettingContext } from "@casino-lord/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BLACKJACK_RULES } from "../rules.js";
import type { Card, HandInput } from "../types.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stateWithLiveInput } from "./test-helpers.js";
import { PlayerView } from "./PlayerView.js";
import "./player-view.css";

const ROUND: BettingRound = {
  id: "r1",
  status: "open",
  openedAt: "2026-01-01T00:00:00.000Z",
};

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

const ME: PlayerState = {
  player: {
    id: "p1",
    name: "Ana",
    color: "#f00",
    status: "active",
    joinedAt: "2026-01-01T00:00:00.000Z",
    seat: 3,
  },
  bankroll: 500,
  openBets: [],
};

const CONTEXT = {
  selectedDenomination: 25,
  showOthersBets: false,
  playerColor: "#f00",
  getOwnStake: () => 0,
  getTableStake: () => 0,
  settlementFlash: null as const,
  settlementByZone: {} as Record<string, "win" | "lose">,
  onZoneTap: vi.fn(),
  onZoneLongPress: vi.fn(),
};

function renderView(
  live: Parameters<typeof stateWithLiveInput>[0],
  round: BettingRound = ROUND,
  me: PlayerState = ME,
) {
  const act = vi.fn();
  const place = vi.fn();
  render(
    <PlayerBettingContext.Provider value={CONTEXT}>
      <PlayerView
        state={stateWithLiveInput(live)}
        rules={DEFAULT_BLACKJACK_RULES}
        me={me}
        round={round}
        place={place}
        remove={vi.fn()}
        act={act}
      />
    </PlayerBettingContext.Provider>,
  );
  return { act, place };
}

describe("PlayerView", () => {
  beforeEach(() => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 360,
    });
  });

  afterEach(() => cleanup());

  it("shows no-seat message when unseated", () => {
    renderView({ dealer: [], seats: {} }, ROUND, {
      ...ME,
      player: { ...ME.player, seat: undefined },
    });
    expect(screen.getByTestId("no-seat-message").textContent).toContain(
      "Ask the dealer for a seat",
    );
  });

  it("renders dealer strip and my hand total", () => {
    renderView({
      dealer: [card("7"), card("10")],
      seats: { 3: [hand([card("9"), card("7")])] },
    });
    expect(screen.getByTestId("dealer-strip")).toBeTruthy();
    expect(screen.getByTestId("my-hand-total-0").textContent).toContain("16");
  });

  it("shows only enabled action buttons on my turn", () => {
    renderView({
      dealer: [card("7"), card("10")],
      seats: { 3: [hand([card("9"), card("7")])] },
      virtual: {
        shoe: [],
        shoeIndex: 0,
        phase: "player",
        activeSeats: [3],
        currentSeat: 3,
        currentHandIndex: 0,
        holeDealt: true,
        dealRound: 2,
        completedHands: [],
        turnStartedAt: "2026-01-01T00:00:10.000Z",
      },
    });
    expect(screen.getByTestId("action-area")).toBeTruthy();
    expect((screen.getByTestId("action-btn-hit") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId("action-btn-split") as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls act on action tap", () => {
    const { act } = renderView({
      dealer: [card("7"), card("10")],
      seats: { 3: [hand([card("9"), card("7")])] },
      virtual: {
        shoe: [],
        shoeIndex: 0,
        phase: "player",
        activeSeats: [3],
        currentSeat: 3,
        currentHandIndex: 0,
        holeDealt: true,
        dealRound: 2,
        completedHands: [],
      },
    });
    fireEvent.click(screen.getByTestId("action-btn-stand"));
    expect(act).toHaveBeenCalledWith("stand");
  });

  it("shows intent message on physical table after hit", () => {
    const { act } = renderView({
      dealer: [card("7")],
      seats: { 3: [hand([card("9"), card("7")])] },
    });
    fireEvent.click(screen.getByTestId("action-btn-hit"));
    expect(act).toHaveBeenCalledWith("hit");
    expect(screen.getByTestId("intent-message").textContent).toContain("Told the dealer: HIT");
  });

  it("shows insurance zones during insurance window", () => {
    renderView({
      dealer: [card("A")],
      seats: { 3: [hand([card("A"), card("K")])] },
      virtual: {
        shoe: [],
        shoeIndex: 0,
        phase: "insurance",
        activeSeats: [3],
        currentSeat: null,
        currentHandIndex: 0,
        holeDealt: true,
        dealRound: 2,
        completedHands: [],
      },
    });
    expect(screen.getByTestId("felt-zone-insurance")).toBeTruthy();
    expect(screen.getByTestId("felt-zone-even_money")).toBeTruthy();
  });

  it("expands other seats strip on tap", () => {
    renderView({
      dealer: [card("7")],
      seats: {
        3: [hand([card("9"), card("7")])],
        1: [hand([card("10"), card("10")])],
      },
    });
    fireEvent.click(screen.getByTestId("other-seats-toggle"));
    expect(screen.getByTestId("other-seats-list")).toBeTruthy();
  });

  it("action buttons meet minimum size at 360px viewport", () => {
    const css = readFileSync(
      join(process.cwd(), "packages/game-blackjack/src/views/player-view.css"),
      "utf8",
    );
    expect(css).toMatch(/\.blackjack-player-view__action-btn[\s\S]*min-height:\s*64px/);
    expect(css).toMatch(/\.blackjack-player-view__action-btn[\s\S]*min-width:\s*48px/);
    expect(css).toMatch(/\.blackjack-player-view__others-toggle[\s\S]*min-height:\s*48px/);

    renderView({
      dealer: [card("7"), card("10")],
      seats: { 3: [hand([card("9"), card("7")])] },
      virtual: {
        shoe: [],
        shoeIndex: 0,
        phase: "player",
        activeSeats: [3],
        currentSeat: 3,
        currentHandIndex: 0,
        holeDealt: true,
        dealRound: 2,
        completedHands: [],
      },
    });
    for (const id of ["hit", "stand", "double", "split", "surrender"]) {
      const btn = screen.getByTestId(`action-btn-${id}`);
      expect(btn.className).toContain("blackjack-player-view__action-btn");
    }
  });
});
