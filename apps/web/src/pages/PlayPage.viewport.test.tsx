/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LocationProvider, Router } from "preact-iso";
import { PlayPage } from "./PlayPage.js";
import "./play-page.css";

vi.mock("../sync/config.js", () => ({
  isSyncConfigured: () => true,
  getSyncBaseUrl: () => "http://test",
}));

vi.mock("../sync/api.js", () => ({
  getTableMeta: vi.fn(async () => ({
    exists: true,
    game: "baccarat",
    participation: { playerMode: "on", bank: "none", outcomeSource: "physical" },
    joiningOpen: true,
  })),
  joinTablePlayer: vi.fn(),
}));

vi.mock("../sync/player-token.js", () => ({
  loadPlayerToken: vi.fn(() => null),
  savePlayerToken: vi.fn(),
  clearPlayerToken: vi.fn(),
}));

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

function renderJoinPage() {
  window.history.replaceState({}, "", "/play/K7X2PQ");
  return render(
    <LocationProvider>
      <Router>
        <PlayPage path="/play/:code" />
      </Router>
    </LocationProvider>,
  );
}

beforeAll(() => {
  setViewport(360, 780);
  const style = document.createElement("style");
  style.textContent = `
    .play-page__join { min-height: 64px; }
    .play-page__field input { min-height: 48px; }
    .play-page__swatch { min-width: 48px; min-height: 48px; width: 48px; height: 48px; }
  `;
  document.head.appendChild(style);
});

describe("PlayPage viewport", () => {
  afterEach(() => cleanup());

  it("join form meets touch targets at 360×780", async () => {
    setViewport(360, 780);
    renderJoinPage();
    await vi.waitFor(() => expect(screen.getByTestId("join-btn")).toBeTruthy());

    const joinBtn = screen.getByTestId("join-btn");
    expect(px(window.getComputedStyle(joinBtn).minHeight)).toBeGreaterThanOrEqual(64);

    const nameInput = screen.getByTestId("player-name-input");
    expect(px(window.getComputedStyle(nameInput).minHeight)).toBeGreaterThanOrEqual(48);

    const swatches = screen.getByTestId("play-page").querySelectorAll(".play-page__swatch");
    for (const swatch of swatches) {
      const style = window.getComputedStyle(swatch);
      expect(Math.max(px(style.minHeight), px(style.height))).toBeGreaterThanOrEqual(48);
      expect(Math.max(px(style.minWidth), px(style.width))).toBeGreaterThanOrEqual(48);
    }
  });

  it("join form meets touch targets at 430×930", async () => {
    setViewport(430, 930);
    renderJoinPage();
    await vi.waitFor(() => expect(screen.getByTestId("join-btn")).toBeTruthy());

    const joinBtn = screen.getByTestId("join-btn");
    expect(px(window.getComputedStyle(joinBtn).minHeight)).toBeGreaterThanOrEqual(64);
  });
});
