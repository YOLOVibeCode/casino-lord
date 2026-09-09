/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocationProvider, Router } from "preact-iso";

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
  loadPlayerToken: () => null,
  savePlayerToken: vi.fn(),
  clearPlayerToken: vi.fn(),
}));

import { PlayPage } from "./PlayPage.js";

describe("PlayPage", () => {
  afterEach(() => cleanup());

  it("renders join form when no stored token", async () => {
    window.history.replaceState({}, "", "/play/K7X2PQ");
    render(
      <LocationProvider>
        <Router>
          <PlayPage path="/play/:code" />
        </Router>
      </LocationProvider>,
    );
    await vi.waitFor(() => {
      expect(screen.getByTestId("play-page")).toBeTruthy();
      expect(screen.getByTestId("player-name-input")).toBeTruthy();
      expect(screen.getByTestId("join-btn")).toBeTruthy();
    });
  });
});
