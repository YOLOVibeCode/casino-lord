/**
 * @vitest-environment jsdom
 */
import type { BettingRound, PlayerState } from "@casino-lord/core";
import { PlayerBettingContext } from "@casino-lord/ui";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BACCARAT_RULES } from "../rules.js";
import { initialState } from "../state.js";
import { stateWithRoadTokens } from "./test-helpers.js";
import { PlayerView } from "./PlayerView.js";

const ROUND: BettingRound = {
  id: "r1",
  status: "open",
  openedAt: "2026-01-01T00:00:00.000Z",
};

const ME: PlayerState = {
  player: {
    id: "p1",
    name: "Ana",
    color: "#f00",
    status: "active",
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
  bankroll: 500,
  openBets: [],
};

const CONTEXT = {
  selectedDenomination: 100,
  showOthersBets: false,
  playerColor: "#f00",
  getOwnStake: () => 0,
  getTableStake: () => 0,
  settlementFlash: null as const,
  onZoneTap: vi.fn(),
  onZoneLongPress: vi.fn(),
};

function renderPlayerView(rules = DEFAULT_BACCARAT_RULES) {
  return render(
    <PlayerBettingContext.Provider value={CONTEXT}>
      <PlayerView
        state={stateWithRoadTokens("B P B")}
        rules={rules}
        me={ME}
        round={ROUND}
        place={vi.fn()}
        remove={vi.fn()}
        act={vi.fn()}
      />
    </PlayerBettingContext.Provider>,
  );
}

describe("PlayerView", () => {
  afterEach(() => cleanup());

  it("renders five zones with payout sublabels", () => {
    renderPlayerView();
    expect(screen.getByTestId("felt-zone-player").textContent).toContain("1:1");
    expect(screen.getByTestId("felt-zone-banker").textContent).toContain("−5%");
    expect(screen.getByTestId("felt-zone-tie").textContent).toContain("8:1");
    expect(screen.getByTestId("felt-zone-player_pair").textContent).toContain("11:1");
    expect(screen.getByTestId("felt-zone-banker_pair").textContent).toContain("11:1");
  });

  it("shows mini big road", () => {
    renderPlayerView();
    expect(screen.getByTestId("mini-big-road")).toBeTruthy();
  });

  it("shows no-commission banker sublabel", () => {
    renderPlayerView({ ...DEFAULT_BACCARAT_RULES, bankerCommission: 0 });
    expect(screen.getByTestId("felt-zone-banker").textContent).toContain("1:2 on 6");
  });
});
