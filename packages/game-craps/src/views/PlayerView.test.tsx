/**
 * @vitest-environment jsdom
 */
import type { BettingRound, PlacedBet, PlayerState } from "@casino-lord/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CRAPS_BET_IDS, type CrapsBetTarget } from "../bet-target.js";
import { DEFAULT_CRAPS_RULES } from "../rules.js";
import { initialState } from "../state.js";
import type { CrapsState } from "../types.js";
import { PlayerView } from "./PlayerView.js";
import { defaultWorking, lookupBetDef } from "./player-view-helpers.js";
import { LONG_PRESS_MS } from "./use-long-press.js";
import { stateWithRollTokens } from "./test-helpers.js";

const PLAYER: PlayerState = {
  player: {
    id: "p1",
    name: "Ana",
    color: "#2563eb",
    status: "active",
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
  bankroll: 1000,
  openBets: [],
};

const OPEN_ROUND: BettingRound = {
  id: "r1",
  status: "open",
  openedAt: "2026-01-01T00:00:00.000Z",
};

function makeMe(overrides: Partial<PlayerState> = {}): PlayerState {
  return { ...PLAYER, ...overrides };
}

function renderPlayerView(
  opts: {
    state?: CrapsState;
    rules?: typeof DEFAULT_CRAPS_RULES;
    me?: PlayerState;
    round?: BettingRound;
    place?: ReturnType<typeof vi.fn>;
    remove?: ReturnType<typeof vi.fn>;
    act?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const place = opts.place ?? vi.fn();
  const remove = opts.remove ?? vi.fn();
  const act = opts.act ?? vi.fn();
  render(
    <PlayerView
      state={opts.state ?? initialState()}
      rules={opts.rules ?? DEFAULT_CRAPS_RULES}
      me={opts.me ?? makeMe()}
      round={opts.round ?? OPEN_ROUND}
      place={place}
      remove={remove}
      act={act}
    />,
  );
  return { place, remove, act };
}

function openProps() {
  screen.getByTestId("props-details").setAttribute("open", "");
}

function openSide() {
  screen.getByTestId("side-details").setAttribute("open", "");
}

function longPressPlaceBox(point: number) {
  const box = screen.getByTestId(`place-box-${point}`);
  fireEvent.mouseDown(box);
  act(() => {
    vi.advanceTimersByTime(LONG_PRESS_MS);
  });
  fireEvent.mouseUp(box);
}

class MockDeviceMotionEvent extends Event {
  accelerationIncludingGravity: DeviceMotionEventAcceleration | null;
  constructor(
    type: string,
    init: { accelerationIncludingGravity?: DeviceMotionEventAcceleration | null } = {},
  ) {
    super(type);
    this.accelerationIncludingGravity = init.accelerationIncludingGravity ?? null;
  }
}

describe("PlayerView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("DeviceMotionEvent", MockDeviceMotionEvent);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders status line and place grid", () => {
    renderPlayerView();
    expect(screen.getByTestId("player-status").textContent).toContain("PUCK");
    expect(screen.getByTestId("place-box-4")).toBeTruthy();
    expect(screen.getByTestId("place-box-10")).toBeTruthy();
  });

  it("greys pass line on point phase with catalogue reason", () => {
    renderPlayerView({ state: stateWithRollTokens("4-4") });
    const pass = screen.getByTestId("bet-zone-pass");
    expect(pass.className).toContain("disabled");
    expect(pass.textContent).toContain("Pass line: only on come-out");
  });

  it("greys come on come-out with catalogue reason", () => {
    renderPlayerView({ state: initialState() });
    const come = screen.getByTestId("bet-zone-come");
    expect(come.className).toContain("disabled");
    expect(come.textContent).toContain("Come: only during point phase");
  });

  it("places pass line on come-out", () => {
    const { place } = renderPlayerView();
    fireEvent.click(screen.getByTestId("bet-zone-pass"));
    expect(place).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "pass",
        amount: 25,
        working: true,
        playerId: "p1",
        roundId: "r1",
      }),
    );
  });

  it("places place bet via tap on place box", () => {
    const { place } = renderPlayerView();
    const box = screen.getByTestId("place-box-6");
    fireEvent.mouseDown(box);
    fireEvent.mouseUp(box);
    expect(place).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "place",
        target: { kind: "point", value: 6 },
      }),
    );
  });

  it("places buy via long-press menu on place box", () => {
    const { place } = renderPlayerView();
    longPressPlaceBox(6);
    fireEvent.click(screen.getByTestId("bet-menu-buy"));
    expect(place).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "buy",
        target: { kind: "point", value: 6 },
      }),
    );
  });

  it("places pass odds when pass line bet exists", () => {
    const passBet: PlacedBet<CrapsBetTarget> = {
      id: "pass-1",
      playerId: "p1",
      roundId: "r1",
      type: "pass",
      amount: 100,
      declared: false,
      working: true,
      placedAt: "2026-01-01T00:00:00.000Z",
      originRoundId: "r1",
    };
    const { place } = renderPlayerView({ me: makeMe({ openBets: [passBet] }) });
    fireEvent.click(screen.getByTestId("bet-zone-pass_odds"));
    expect(place).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "pass_odds",
        target: { kind: "attach", line: "pass" },
      }),
    );
  });

  it("places dont odds when dont pass bet exists", () => {
    const dontBet: PlacedBet<CrapsBetTarget> = {
      id: "dp-1",
      playerId: "p1",
      roundId: "r1",
      type: "dont_pass",
      amount: 100,
      declared: false,
      working: true,
      placedAt: "2026-01-01T00:00:00.000Z",
      originRoundId: "r1",
    };
    const { place } = renderPlayerView({ me: makeMe({ openBets: [dontBet] }) });
    fireEvent.click(screen.getByTestId("bet-zone-dont_odds"));
    expect(place).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "dont_odds",
        target: { kind: "attach", line: "dont_pass" },
      }),
    );
  });

  it("renders travelled come chip with C marker", () => {
    const comeBet: PlacedBet<CrapsBetTarget> = {
      id: "come-8",
      playerId: "p1",
      roundId: "r1",
      type: "come",
      target: { kind: "point", value: 8 },
      amount: 25,
      declared: false,
      working: true,
      placedAt: "2026-01-01T00:00:00.000Z",
      originRoundId: "r1",
    };
    renderPlayerView({ me: makeMe({ openBets: [comeBet] }) });
    const chip = screen.getByTestId("come-chip-8");
    expect(chip.textContent).toContain("25");
    expect(chip.textContent).toContain("C");
  });

  it("working toggle emits toggle_working action", () => {
    const comeBet: PlacedBet<CrapsBetTarget> = {
      id: "come-8",
      playerId: "p1",
      roundId: "r1",
      type: "come",
      target: { kind: "point", value: 8 },
      amount: 25,
      declared: false,
      working: true,
      placedAt: "2026-01-01T00:00:00.000Z",
      originRoundId: "r1",
    };
    const { act } = renderPlayerView({ me: makeMe({ openBets: [comeBet] }) });
    fireEvent.click(screen.getByTestId("come-chip-8"));
    fireEvent.click(screen.getByTestId("working-toggle"));
    expect(act).toHaveBeenCalledWith({ kind: "toggle_working", betId: "come-8" });
  });

  it("shows shooter controls only for current shooter", () => {
    const state = { ...initialState(), currentShooterId: "p1" };
    renderPlayerView({ state, me: makeMe() });
    expect(screen.getByTestId("shooter-controls")).toBeTruthy();
    expect(screen.getByTestId("shooter-roll")).toBeTruthy();
  });

  it("hides shooter controls for non-shooter", () => {
    const state = { ...initialState(), currentShooterId: "p2" };
    renderPlayerView({ state, me: makeMe() });
    expect(screen.queryByTestId("shooter-controls")).toBeNull();
  });

  it("ROLL button emits roll action", async () => {
    const state = { ...initialState(), currentShooterId: "p1" };
    const { act: actFn } = renderPlayerView({ state, me: makeMe() });
    await act(async () => {
      fireEvent.click(screen.getByTestId("shooter-roll"));
    });
    expect(actFn).toHaveBeenCalledWith({ kind: "roll" });
  });

  it("pass dice emits pass_dice action", () => {
    const state = { ...initialState(), currentShooterId: "p1" };
    const { act } = renderPlayerView({ state, me: makeMe() });
    fireEvent.click(screen.getByTestId("shooter-pass-dice"));
    expect(act).toHaveBeenCalledWith({ kind: "pass_dice" });
  });

  it("shake above threshold emits roll action", () => {
    const state = { ...initialState(), currentShooterId: "p1" };
    const { act } = renderPlayerView({ state, me: makeMe() });
    window.dispatchEvent(
      new DeviceMotionEvent("devicemotion", {
        accelerationIncludingGravity: { x: 5, y: 5, z: 5 } as DeviceMotionEventAcceleration,
      }),
    );
    expect(act).not.toHaveBeenCalled();
    window.dispatchEvent(
      new DeviceMotionEvent("devicemotion", {
        accelerationIncludingGravity: { x: 20, y: 20, z: 20 } as DeviceMotionEventAcceleration,
      }),
    );
    expect(act).toHaveBeenCalledWith({ kind: "roll" });
  });

  it("place cells and sheet rows are at least 48px at 360px viewport", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 360 });
    renderPlayerView();
    const box = screen.getByTestId("place-box-6");
    longPressPlaceBox(6);
    expect(parseInt(box.style.minHeight, 10)).toBeGreaterThanOrEqual(48);
    const row = screen.getByTestId("bet-menu-buy");
    expect(parseInt(row.style.minHeight, 10)).toBeGreaterThanOrEqual(48);
  });

  it("covers every catalogue bet id via UI paths", () => {
    const pointState = stateWithRollTokens("4-4");
    const passBet: PlacedBet<CrapsBetTarget> = {
      id: "pass-1",
      playerId: "p1",
      roundId: "r1",
      type: "pass",
      amount: 100,
      declared: false,
      working: true,
      placedAt: "",
      originRoundId: "r1",
    };
    const dontBet: PlacedBet<CrapsBetTarget> = {
      id: "dp-1",
      playerId: "p1",
      roundId: "r1",
      type: "dont_pass",
      amount: 100,
      declared: false,
      working: true,
      placedAt: "",
      originRoundId: "r1",
    };

    for (const betId of CRAPS_BET_IDS) {
      cleanup();
      const place = vi.fn();
      const state = betId === "come" || betId === "dont_come" ? pointState : initialState();
      const me =
        betId === "pass_odds"
          ? makeMe({ openBets: [passBet] })
          : betId === "dont_odds"
            ? makeMe({ openBets: [dontBet] })
            : makeMe();

      renderPlayerView({ state, me, place, rules: { ...DEFAULT_CRAPS_RULES, hornHigh: true } });

      if (betId === "place") {
        const box = screen.getByTestId("place-box-6");
        fireEvent.mouseDown(box);
        fireEvent.mouseUp(box);
      } else if (betId === "buy" || betId === "lay" || betId === "hard") {
        longPressPlaceBox(6);
        fireEvent.click(screen.getByTestId(`bet-menu-${betId}`));
      } else if (betId === "pass_odds") {
        fireEvent.click(screen.getByTestId("bet-zone-pass_odds"));
      } else if (betId === "dont_odds") {
        fireEvent.click(screen.getByTestId("bet-zone-dont_odds"));
      } else if (
        [
          "any_seven",
          "any_craps",
          "two",
          "twelve",
          "three",
          "eleven",
          "horn",
          "horn_high_2",
          "horn_high_3",
          "horn_high_11",
          "horn_high_12",
          "ce",
        ].includes(betId)
      ) {
        openProps();
        fireEvent.click(screen.getByTestId(`bet-zone-${betId}`));
      } else if (["fire", "ats_small", "ats_tall", "ats_all"].includes(betId)) {
        openSide();
        fireEvent.click(screen.getByTestId(`bet-zone-${betId}`));
      } else {
        fireEvent.click(screen.getByTestId(`bet-zone-${betId}`));
      }

      expect(place, `place not called for betId=${betId}`).toHaveBeenCalled();
      const call = place.mock.calls[0]?.[0];
      expect(call?.type, `wrong type for betId=${betId}`).toBe(betId);
      const def = lookupBetDef(betId);
      if (def) {
        expect(call?.working).toBe(defaultWorking(betId, DEFAULT_CRAPS_RULES, state));
      }
    }
  });
});
