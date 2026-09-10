/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocationProvider, Router } from "preact-iso";
import { getTableMeta } from "../sync/api.js";

vi.mock("../sync/config.js", () => ({
  isSyncConfigured: () => true,
  getSyncBaseUrl: () => "http://test",
}));

let mockTableGame: "baccarat" | "roulette" = "baccarat";

vi.mock("../sync/api.js", () => ({
  getTableMeta: vi.fn(async () => ({
    exists: true,
    game: mockTableGame,
    participation: { playerMode: "on", bank: "none", outcomeSource: "physical" },
    joiningOpen: true,
  })),
  joinTablePlayer: vi.fn(),
}));

const loadPlayerToken = vi.fn(() => null as string | null);

vi.mock("../sync/player-token.js", () => ({
  loadPlayerToken: () => loadPlayerToken(),
  savePlayerToken: vi.fn(),
  clearPlayerToken: vi.fn(),
}));

vi.mock("../table/synced-store.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../table/synced-store.js")>();
  const { baccaratModule } = await import("@casino-lord/game-baccarat");
  const { DEFAULT_BACCARAT_RULES } = await import("@casino-lord/game-baccarat");
  const { rouletteModule } = await import("@casino-lord/game-roulette");
  const { DEFAULT_ROULETTE_RULES } = await import("@casino-lord/game-roulette");
  const { createTableStore } = await import("../table/store.js");
  const { asUntypedModule } = await import("../table/module-types.js");
  const { houseSettings } = await import("@casino-lord/core/testing");

  return {
    ...orig,
    waitForSyncReady: vi.fn(async () => {}),
    createSyncedTableStore: vi.fn(() => {
      const isRoulette = mockTableGame === "roulette";
      const module = asUntypedModule(isRoulette ? rouletteModule : baccaratModule);
      const store = createTableStore({
        game: mockTableGame,
        module,
        rules: isRoulette ? DEFAULT_ROULETTE_RULES : DEFAULT_BACCARAT_RULES,
        rng: () => 0,
        now: () => "2026-01-01T00:00:00.000Z",
        id: () => "id-1",
      });
      store.emit({ type: "PARTICIPATION_CHANGED", participation: houseSettings().participation });
      store.emit({
        type: "PLAYER_JOINED",
        player: {
          id: "p1",
          name: "Ana",
          color: "#f00",
          status: "active",
          joinedAt: "2026-01-01T00:00:01.000Z",
        },
      });
      return {
        ...store,
        getPlayerId: () => "p1",
        getConnectionState: () => "connected" as const,
        getRejectReason: () => null,
        getModule: () => module,
        destroy: vi.fn(),
        subscribe: store.subscribe,
      };
    }),
  };
});

import { PlayPage } from "./PlayPage.js";

describe("PlayPage", () => {
  afterEach(() => {
    mockTableGame = "baccarat";
    loadPlayerToken.mockReturnValue(null);
    cleanup();
  });

  it("renders player shell when stored token exists", async () => {
    loadPlayerToken.mockReturnValue("token-abc");
    window.history.replaceState({}, "", "/play/K7X2PQ");
    render(
      <LocationProvider>
        <Router>
          <PlayPage path="/play/:code" />
        </Router>
      </LocationProvider>,
    );
    await vi.waitFor(() => {
      expect(screen.getByTestId("player-shell")).toBeTruthy();
    });
  });

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

  it("renders roulette player view without baccarat felt zones", async () => {
    mockTableGame = "roulette";
    vi.mocked(getTableMeta).mockResolvedValueOnce({
      exists: true,
      game: "roulette",
      participation: { playerMode: "on", bank: "none", outcomeSource: "physical" },
      joiningOpen: true,
    });
    loadPlayerToken.mockReturnValue("token-roulette");
    window.history.replaceState({}, "", "/play/K7X2PQ");
    render(
      <LocationProvider>
        <Router>
          <PlayPage path="/play/:code" />
        </Router>
      </LocationProvider>,
    );
    await vi.waitFor(() => {
      expect(screen.getByTestId("player-shell")).toBeTruthy();
    });
    expect(screen.getByTestId("roulette-player-view")).toBeTruthy();
    expect(screen.queryByTestId("felt-zone-banker")).toBeNull();
  });
});
