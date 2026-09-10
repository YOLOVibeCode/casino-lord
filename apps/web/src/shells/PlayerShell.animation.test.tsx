/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { houseSettings } from "@casino-lord/core/testing";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import { PlayerShell } from "./PlayerShell.js";
import "./player-shell.css";

const baccarat = asUntypedModule(baccaratModule);

function quickResult(outcome: "P" | "B" | "T") {
  return {
    cards: null,
    outcome,
    playerTotal: outcome === "P" ? 7 : outcome === "T" ? 7 : 4,
    bankerTotal: outcome === "B" ? 8 : outcome === "T" ? 7 : 9,
    playerPair: false,
    bankerPair: false,
    natural: false,
  };
}

function setupJoinedStore() {
  let n = 0;
  const store = createTableStore({
    game: "baccarat",
    module: baccarat,
    rules: DEFAULT_BACCARAT_RULES,
    rng: () => 0,
    now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
    id: () => `id-${n}`,
  });

  store.emit({ type: "PARTICIPATION_CHANGED", participation: houseSettings().participation });
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
  store.emit({ type: "BANK_ISSUED", playerId: "p1", amount: 500, reason: "buyin" });

  const syncStore = {
    ...store,
    getPlayerId: () => "p1",
    getConnectionState: () => "connected" as const,
  };

  return syncStore;
}

describe("PlayerShell animations", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not animate when mounting with existing history", () => {
    const store = setupJoinedStore();
    store.record(quickResult("B"), { quick: true });
    store.record(quickResult("P"), { quick: true });

    render(<PlayerShell store={store} playerName="Ana" />);

    expect(screen.queryByTestId("animation-layer")).toBeNull();
  });

  it("does not schedule animations when phoneAnimations is off", async () => {
    localStorage.setItem(
      "casino-lord:device-settings",
      JSON.stringify({ ...DEFAULT_DEVICE_SETTINGS, phoneAnimations: "off" }),
    );
    vi.useFakeTimers();
    const store = setupJoinedStore();

    render(<PlayerShell store={store} playerName="Ana" />);

    await act(async () => {
      store.record(quickResult("B"), { quick: true });
    });

    expect(screen.queryByTestId("animation-layer")).toBeNull();
    localStorage.removeItem("casino-lord:device-settings");
  });

  it("schedules one main animation when a new result is recorded", async () => {
    vi.useFakeTimers();
    const store = setupJoinedStore();

    render(<PlayerShell store={store} playerName="Ana" />);

    await act(async () => {
      store.record(quickResult("B"), { quick: true });
    });

    expect(screen.getByTestId("animation-layer")).toBeTruthy();
    const mainSegments = document.querySelectorAll('[data-phase="main"]');
    expect(mainSegments.length).toBe(1);
    expect(document.querySelector('[data-style="dragon"][data-phase="main"]')).toBeNull();
  });
});
