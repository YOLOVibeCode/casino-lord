/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocationProvider, Router } from "preact-iso";

vi.mock("../sync/config.js", () => ({
  isSyncConfigured: () => true,
  getSyncBaseUrl: () => "http://test",
}));

const getTableMetaMock = vi.fn(async () => ({
  exists: true,
  game: "roulette" as const,
  participation: { playerMode: "on" as const, bank: "none" as const, outcomeSource: "physical" as const },
  joiningOpen: true,
}));

vi.mock("../sync/api.js", () => ({
  getTableMeta: (...args: unknown[]) => getTableMetaMock(...args),
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
  const { createTableStore } = await import("../table/store.js");
  const { asUntypedModule } = await import("../table/module-types.js");
  const { houseSettings } = await import("@casino-lord/core/testing");

  return {
    ...orig,
    waitForSyncReady: vi.fn(async () => {}),
    createSyncedTableStore: vi.fn(() => {
      const store = createTableStore({
        game: "baccarat",
        module: asUntypedModule(baccaratModule),
        rules: DEFAULT_BACCARAT_RULES,
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
        destroy: vi.fn(),
        subscribe: store.subscribe,
      };
    }),
  };
});

import { PlayPage } from "./PlayPage.js";

describe("PlayPage", () => {
  afterEach(() => cleanup());

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
    loadPlayerToken.mockReturnValue(null);
  });

  it("passes the roulette module from table meta to the synced store", async () => {
    const { createSyncedTableStore } = await import("../table/synced-store.js");
    const { rouletteModule } = await import("@casino-lord/game-roulette");
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
      expect(vi.mocked(createSyncedTableStore)).toHaveBeenCalled();
    });
    const call = vi.mocked(createSyncedTableStore).mock.calls[0]?.[0] as { module: { id: string } };
    expect(call.module.id).toBe(rouletteModule.id);
    loadPlayerToken.mockReturnValue(null);
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
});
