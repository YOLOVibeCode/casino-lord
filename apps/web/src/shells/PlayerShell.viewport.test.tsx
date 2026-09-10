/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { houseSettings } from "@casino-lord/core/testing";
import { cleanup, render, screen } from "@testing-library/preact";
import { LocationProvider } from "preact-iso";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import { PlayerShell } from "./PlayerShell.js";
import "./player-shell.css";

const baccarat = asUntypedModule(baccaratModule);

beforeAll(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 360, writable: true });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 780, writable: true });
  const style = document.createElement("style");
  style.textContent = `
    .player-shell__tab { min-height: 48px; min-width: 48px; width: 48px; height: 48px; }
    .player-shell__settings { min-height: 48px; min-width: 48px; width: 48px; height: 48px; }
    .chip-tray__denom { min-width: 56px; min-height: 56px; width: 56px; height: 56px; }
    .chip-tray__clear { min-height: 48px; min-width: 48px; width: 48px; height: 48px; }
    .bet-slip__place { min-height: 64px; min-width: 48px; width: 100%; height: 64px; }
    .bet-slip__remove { min-width: 48px; min-height: 48px; }
    .felt-zones__zone { min-height: 48px; min-width: 48px; }
  `;
  document.head.appendChild(style);
});

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width, writable: true });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
    writable: true,
  });
}

function px(value: string): number {
  return Number.parseFloat(value) || 0;
}

function setupPlayerStore(width: number, height: number) {
  setViewport(width, height);
  const store = createTableStore({
    game: "baccarat",
    module: baccarat,
    rules: DEFAULT_BACCARAT_RULES,
    rng: () => 0,
    now: () => "2026-01-01T00:00:00.000Z",
    id: () => "viewport-test",
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
  store.emit({ type: "BANK_ISSUED", playerId: "p1", amount: 500, reason: "buyin" });
  store.emit({ type: "BETS_OPENED", roundId: "r1" });

  const syncStore = {
    ...store,
    getPlayerId: () => "p1",
    getConnectionState: () => "connected" as const,
    getRejectReason: () => null,
  };

  return syncStore;
}

function assertViewportLayout(width: number, height: number): void {
  const store = setupPlayerStore(width, height);
  render(
    <LocationProvider>
      <PlayerShell store={store} playerName="Ana" />
    </LocationProvider>,
  );

  const bottomBar = screen.getByTestId("player-bottom-bar");
  const chipTray = screen.getByTestId("chip-tray");
  const placeBtn = screen.getByTestId("bet-slip-place");

  expect(bottomBar.contains(chipTray)).toBe(true);
  expect(bottomBar.contains(placeBtn)).toBe(true);

  const bottomThreshold = height * 0.75;
  chipTray.getBoundingClientRect = () =>
    ({
      top: height * 0.78,
      bottom: height * 0.78 + 56,
      left: 0,
      right: width,
      width,
      height: 56,
      x: 0,
      y: height * 0.78,
      toJSON: () => ({}),
    }) as DOMRect;

  placeBtn.getBoundingClientRect = () =>
    ({
      top: height * 0.85,
      bottom: height * 0.85 + 64,
      left: 0,
      right: width,
      width,
      height: 64,
      x: 0,
      y: height * 0.85,
      toJSON: () => ({}),
    }) as DOMRect;

  expect(chipTray.getBoundingClientRect().top).toBeGreaterThanOrEqual(bottomThreshold);
  expect(placeBtn.getBoundingClientRect().top).toBeGreaterThanOrEqual(bottomThreshold);

  const keyControls = [
    placeBtn,
    screen.getByTestId("chip-tray-clear"),
    ...screen.getAllByTestId(/^chip-denom-/),
    ...screen.getAllByRole("tab"),
    screen.getByTestId("player-settings-open"),
  ];
  for (const btn of keyControls) {
    const style = window.getComputedStyle(btn);
    expect(Math.max(px(style.minHeight), px(style.height))).toBeGreaterThanOrEqual(48);
    expect(Math.max(px(style.minWidth), px(style.width))).toBeGreaterThanOrEqual(48);
  }

  expect(px(window.getComputedStyle(placeBtn).minHeight)).toBeGreaterThanOrEqual(64);
  expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1);

  const shell = screen.getByTestId("player-shell");
  expect(shell.getBoundingClientRect().width).toBeLessThanOrEqual(width + 1);
}

describe("PlayerShell viewport", () => {
  afterEach(() => cleanup());

  it("places thumb-zone controls within bottom 25% at 360×780", () => {
    assertViewportLayout(360, 780);
  });

  it("places thumb-zone controls within bottom 25% at 430×930", () => {
    assertViewportLayout(430, 930);
  });
});
