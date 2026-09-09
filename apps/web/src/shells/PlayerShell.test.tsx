/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { houseSettings } from "@casino-lord/core/testing";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import { PlayerShell } from "./PlayerShell.js";

describe("PlayerShell", () => {
  afterEach(() => cleanup());

  function setupStore(opts?: { bankroll?: number; roundOpen?: boolean }) {
    const module = asUntypedModule(baccaratModule);
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "bet-id-1",
    });

    store.emit({ type: "PARTICIPATION_CHANGED", participation: houseSettings().participation });
    store.emit({
      type: "SETTINGS_CHANGED",
      patch: { bank: { ...houseSettings().bank, chipDenominations: [5, 25, 100, 500] } },
    });
    store.emit({
      type: "PLAYER_JOINED",
      player: {
        id: "p1",
        name: "Ana",
        color: "#e5322d",
        status: "active",
        joinedAt: "2026-01-01T00:00:01.000Z",
      },
    });
    store.emit({
      type: "BANK_ISSUED",
      playerId: "p1",
      amount: opts?.bankroll ?? 500,
      reason: "buyin",
    });

    if (opts?.roundOpen !== false) {
      store.emit({ type: "BETS_OPENED", roundId: "r1" });
    }

    const syncStore = {
      ...store,
      getPlayerId: () => "p1",
      getConnectionState: () => "connected" as const,
    };

    return { store: syncStore, module };
  }

  it("renders baccarat player view", () => {
    const { store } = setupStore();
    render(<PlayerShell store={store} playerName="Ana" />);
    expect(screen.getByTestId("baccarat-player-view")).toBeTruthy();
  });

  it("PLACE emits BET_PLACED with roundId", () => {
    const { store } = setupStore();
    const emitSpy = vi.spyOn(store, "emit");
    render(<PlayerShell store={store} playerName="Ana" />);

    fireEvent.click(screen.getByTestId("chip-denom-100"));
    const zone = screen.getByTestId("felt-zone-banker");
    fireEvent.mouseDown(zone);
    fireEvent.mouseUp(zone);
    fireEvent.click(screen.getByTestId("bet-slip-place"));

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "BET_PLACED",
        bet: expect.objectContaining({
          playerId: "p1",
          roundId: "r1",
          type: "banker",
          amount: 100,
        }),
      }),
    );
  });

  it("shows validation when bets closed", () => {
    const { store } = setupStore({ roundOpen: false });
    store.emit({ type: "BETS_OPENED", roundId: "r1" });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });

    render(<PlayerShell store={store} playerName="Ana" />);
    expect(screen.getByTestId("bet-slip-locked")).toBeTruthy();
  });

  it("shows insufficient bankroll error", () => {
    const { store } = setupStore({ bankroll: 50 });
    render(<PlayerShell store={store} playerName="Ana" />);

    fireEvent.click(screen.getByTestId("chip-denom-100"));
    const zone = screen.getByTestId("felt-zone-banker");
    fireEvent.mouseDown(zone);
    fireEvent.mouseUp(zone);
    expect(screen.getByTestId("bet-slip-error").textContent).toContain("Insufficient");
  });

  it("shows over max validation error", () => {
    const { store } = setupStore();
    store.emit({
      type: "SETTINGS_CHANGED",
      patch: { bank: { ...houseSettings().bank, tableMax: 50, chipDenominations: [5, 25, 100] } },
    });
    render(<PlayerShell store={store} playerName="Ana" />);

    fireEvent.click(screen.getByTestId("chip-denom-100"));
    const zone = screen.getByTestId("felt-zone-banker");
    fireEvent.mouseDown(zone);
    fireEvent.mouseUp(zone);
    expect(screen.getByTestId("bet-slip-error").textContent).toContain("Maximum");
  });

  it("emits BET_REMOVED when removing placed bet from slip", () => {
    const { store } = setupStore();
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "banker",
        amount: 100,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });
    const emitSpy = vi.spyOn(store, "emit");
    render(<PlayerShell store={store} playerName="Ana" />);
    fireEvent.click(screen.getByTestId("bet-slip-remove-b1"));
    expect(emitSpy).toHaveBeenCalledWith({ type: "BET_REMOVED", betId: "b1" });
  });

  it("shows settlement summary after banker win", () => {
    const { store } = setupStore();
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "banker",
        amount: 100,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });
    store.record(
      {
        cards: null,
        outcome: "B",
        playerTotal: 4,
        bankerTotal: 9,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );
    render(<PlayerShell store={store} playerName="Ana" />);
    expect(screen.getByTestId("player-status-bar").textContent).toContain("Banker 9");
    expect(screen.getByTestId("player-status-bar").textContent).toContain("+95");
  });

  it("shows rebuy hint at zero bankroll", () => {
    const { store } = setupStore({ bankroll: 0 });
    render(<PlayerShell store={store} playerName="Ana" />);
    expect(screen.getByTestId("player-rebuy-hint")).toBeTruthy();
  });

  it("emits away after 60s hidden", () => {
    vi.useFakeTimers();
    const { store } = setupStore();
    const emitSpy = vi.spyOn(store, "emit");
    render(<PlayerShell store={store} playerName="Ana" />);

    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(60_000);

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PLAYER_UPDATED",
        playerId: "p1",
        patch: { status: "away" },
      }),
    );

    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PLAYER_UPDATED",
        patch: { status: "active" },
      }),
    );

    vi.useRealTimers();
  });
});
