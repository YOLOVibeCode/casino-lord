/**
 * @vitest-environment jsdom
 */
import type { BettingRound, PlacedBet, PlayerState } from "@casino-lord/core";
import { PlayerBettingContext } from "@casino-lord/ui";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RouletteBetTarget } from "../bet-target.js";
import { DEFAULT_ROULETTE_RULES } from "../rules.js";
import { initialState } from "../state.js";
import { PlayerView } from "./PlayerView.js";
import { stateWithSpins } from "./test-helpers.js";

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

function renderPlayerView(
  props: Partial<{
    rules: typeof DEFAULT_ROULETTE_RULES;
    round: BettingRound;
    me: PlayerState;
    state: ReturnType<typeof initialState>;
  }> = {},
) {
  const place = vi.fn();
  const remove = vi.fn();
  const onZoneTap = vi.fn();
  const onZoneLongPress = vi.fn();

  render(
    <PlayerBettingContext.Provider
      value={{
        selectedDenomination: 25,
        showOthersBets: false,
        playerColor: "#f00",
        bettingDisabled: false,
        getOwnStake: () => 0,
        getTableStake: () => 0,
        settlementFlash: null,
        settlementByZone: {},
        onZoneTap,
        onZoneLongPress,
      }}
    >
      <div style={{ width: "360px" }}>
        <PlayerView
          state={props.state ?? stateWithSpins("17 32 0 5 22")}
          rules={props.rules ?? DEFAULT_ROULETTE_RULES}
          me={props.me ?? ME}
          round={props.round ?? ROUND}
          place={place}
          remove={remove}
          act={vi.fn()}
        />
      </div>
    </PlayerBettingContext.Provider>,
  );

  return { place, remove, onZoneTap, onZoneLongPress };
}

describe("PlayerView", () => {
  afterEach(() => cleanup());

  it("renders non-empty felt", () => {
    renderPlayerView();
    expect(screen.getByTestId("roulette-player-view")).toBeTruthy();
    expect(screen.getByTestId("player-felt-grid")).toBeTruthy();
    expect(screen.getByTestId("player-felt-number-17")).toBeTruthy();
  });

  it("number cells are at least 48px at 360px viewport", () => {
    renderPlayerView();
    const cell = screen.getByTestId("player-felt-number-17");
    const styles = getComputedStyle(cell);
    expect(parseFloat(styles.minWidth)).toBeGreaterThanOrEqual(48);
    expect(parseFloat(styles.minHeight)).toBeGreaterThanOrEqual(48);
  });

  it("hides racetrack on American wheel", () => {
    renderPlayerView({
      rules: { ...DEFAULT_ROULETTE_RULES, wheel: "american" },
    });
    expect(screen.queryByTestId("racetrack-toggle")).toBeNull();
    expect(screen.queryByTestId("racetrack")).toBeNull();
  });

  it("shows racetrack toggle on European wheel", () => {
    renderPlayerView();
    expect(screen.getByTestId("racetrack-toggle")).toBeTruthy();
  });

  it("shows magnifier label on straight 17 hit zone press", () => {
    renderPlayerView();
    const hit = screen.getByTestId("felt-hit-straight:17");
    fireEvent.mouseDown(hit);
    expect(screen.getByTestId("felt-magnifier").textContent).toContain("17");
    fireEvent.mouseUp(hit);
  });

  it("places straight 17 via hit zone click", () => {
    const { place } = renderPlayerView();
    fireEvent.click(screen.getByTestId("felt-hit-straight:17"));
    expect(place).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "straight",
        target: { kind: "straight", pocket: 17 },
        amount: 25,
      }),
    );
  });

  it("delegates red tap to parent onZoneTap", () => {
    const { onZoneTap } = renderPlayerView();
    fireEvent.pointerDown(screen.getByTestId("felt-zone-red"), { pointerId: 1 });
    fireEvent.pointerUp(screen.getByTestId("felt-zone-red"), { pointerId: 1 });
    expect(onZoneTap).toHaveBeenCalledWith("red");
  });

  it("disables basket hit on American wheel", () => {
    renderPlayerView({
      rules: { ...DEFAULT_ROULETTE_RULES, wheel: "american" },
    });
    expect(screen.queryByTestId("felt-hit-basket")).toBeNull();
  });

  it("repeat last calls place for each prior bet when bankroll allows", async () => {
    const openRound: BettingRound = {
      id: "r0",
      status: "open",
      openedAt: "2026-01-01T00:00:00.000Z",
    };
    const settledRound: BettingRound = {
      id: "r0",
      status: "settled",
      openedAt: "2026-01-01T00:00:00.000Z",
    };
    const nextOpenRound: BettingRound = {
      id: "r1",
      status: "open",
      openedAt: "2026-01-01T00:00:01.000Z",
    };

    const priorBet: PlacedBet<RouletteBetTarget> = {
      id: "b1",
      playerId: "p1",
      roundId: "r0",
      type: "straight",
      target: { kind: "straight", pocket: 17 },
      amount: 25,
      declared: true,
      working: false,
      placedAt: "2026-01-01T00:00:00.000Z",
      originRoundId: "r0",
    };

    const place = vi.fn();
    const ctx = {
      selectedDenomination: 25,
      showOthersBets: false,
      playerColor: "#f00",
      bettingDisabled: false,
      getOwnStake: () => 0,
      getTableStake: () => 0,
      settlementFlash: null as const,
      settlementByZone: {},
      onZoneTap: vi.fn(),
      onZoneLongPress: vi.fn(),
    };

    const { rerender } = render(
      <PlayerBettingContext.Provider value={ctx}>
        <div style={{ width: "360px" }}>
          <PlayerView
            state={stateWithSpins("17")}
            rules={DEFAULT_ROULETTE_RULES}
            me={{ ...ME, openBets: [priorBet] }}
            round={openRound}
            place={place}
            remove={vi.fn()}
            act={vi.fn()}
          />
        </div>
      </PlayerBettingContext.Provider>,
    );

    rerender(
      <PlayerBettingContext.Provider value={ctx}>
        <div style={{ width: "360px" }}>
          <PlayerView
            state={stateWithSpins("17")}
            rules={DEFAULT_ROULETTE_RULES}
            me={{ ...ME, openBets: [] }}
            round={settledRound}
            place={place}
            remove={vi.fn()}
            act={vi.fn()}
          />
        </div>
      </PlayerBettingContext.Provider>,
    );

    rerender(
      <PlayerBettingContext.Provider value={ctx}>
        <div style={{ width: "360px" }}>
          <PlayerView
            state={stateWithSpins("17")}
            rules={DEFAULT_ROULETTE_RULES}
            me={{ ...ME, openBets: [] }}
            round={nextOpenRound}
            place={place}
            remove={vi.fn()}
            act={vi.fn()}
          />
        </div>
      </PlayerBettingContext.Provider>,
    );

    const repeatBtn = screen.getByTestId("repeat-last") as HTMLButtonElement;
    await waitFor(() => expect(repeatBtn.disabled).toBe(false));
    fireEvent.click(repeatBtn);
    expect(place).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "straight",
        target: { kind: "straight", pocket: 17 },
        amount: 25,
      }),
    );
  });

  it("shows history and hot panels", () => {
    renderPlayerView();
    expect(screen.getByTestId("player-history")).toBeTruthy();
    expect(screen.getByTestId("player-history-17")).toBeTruthy();
  });
});
