/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const loadPlayerToken = vi.fn(() => null as string | null);
const savePlayerToken = vi.fn();
const clearPlayerToken = vi.fn();

vi.mock("../sync/player-token.js", () => ({
  loadPlayerToken: () => loadPlayerToken(),
  savePlayerToken: (...args: unknown[]) => savePlayerToken(...args),
  clearPlayerToken: (...args: unknown[]) => clearPlayerToken(...args),
}));

const createSyncedTableStore = vi.fn();
const waitForSyncReady = vi.fn(async (store: { getRejectReason: () => string | null }) => {
  const reason = store.getRejectReason();
  if (reason) {
    throw new Error(reason);
  }
});

vi.mock("../table/synced-store.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../table/synced-store.js")>();
  const { baccaratModule } = await import("@casino-lord/game-baccarat");
  const { DEFAULT_BACCARAT_RULES } = await import("@casino-lord/game-baccarat");
  const { createTableStore } = await import("../table/store.js");
  const { asUntypedModule } = await import("../table/module-types.js");
  const { houseSettings } = await import("@casino-lord/core/testing");

  return {
    ...orig,
    waitForSyncReady: (...args: unknown[]) => waitForSyncReady(...args),
    createSyncedTableStore: (...args: unknown[]) => createSyncedTableStore(...args),
  };
});

import { PLAYER_COLORS } from "@casino-lord/core";
import { baccaratModule, DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { getTableMeta } from "../sync/api.js";
import { houseSettings } from "@casino-lord/core/testing";
import { PlayPage } from "./PlayPage.js";
import { createTableStore } from "../table/store.js";
import { asUntypedModule } from "../table/module-types.js";

function buildMockStore(options?: {
  onJoinError?: (code: string) => void;
  rejectToken?: boolean;
}) {

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

  const rejectReason = options?.rejectToken ? "BAD_TOKEN" : null;

  return {
    ...store,
    getPlayerId: () => "p1",
    getConnectionState: () => (rejectReason ? "reconnecting" : "connected"),
    getRejectReason: () => rejectReason,
    destroy: vi.fn(),
    subscribe: store.subscribe,
  };
}

function renderPlayPage(path = "/play/K7X2PQ") {
  window.history.replaceState({}, "", path);
  render(
    <LocationProvider>
      <Router>
        <PlayPage path="/play/:code" />
      </Router>
    </LocationProvider>,
  );
}

describe("PlayPage", () => {
  beforeEach(() => {
    loadPlayerToken.mockReturnValue(null);
    createSyncedTableStore.mockImplementation(
      (opts: { token?: string; onJoinError?: (code: string) => void }) => {
        const rejectToken = opts.token === "bad-token";
        if (rejectToken && opts.onJoinError) {
          queueMicrotask(() => opts.onJoinError!("BAD_TOKEN"));
        }
        return buildMockStore({ rejectToken });
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    loadPlayerToken.mockReturnValue(null);
  });

  it("renders player shell when stored token exists", async () => {
    loadPlayerToken.mockReturnValue("token-abc");
    renderPlayPage("/play/K7X2PQ");
    await vi.waitFor(() => {
      expect(screen.getByTestId("player-shell")).toBeTruthy();
    });
    expect(createSyncedTableStore).toHaveBeenCalledWith(
      expect.objectContaining({ token: "token-abc" }),
    );
  });

  it("renders join form when no stored token", async () => {
    renderPlayPage("/play/K7X2PQ");
    await vi.waitFor(() => {
      expect(screen.getByTestId("play-page")).toBeTruthy();
      expect(screen.getByTestId("player-name-input")).toBeTruthy();
      expect(screen.getByTestId("join-btn")).toBeTruthy();
    });
  });

  it("connects with ?t= query token and strips it from the URL", async () => {
    renderPlayPage("/play/K7X2PQ?t=reissued-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("player-shell")).toBeTruthy();
    });
    expect(savePlayerToken).toHaveBeenCalledWith("K7X2PQ", "reissued-token");
    expect(createSyncedTableStore).toHaveBeenCalledWith(
      expect.objectContaining({ token: "reissued-token" }),
    );
    expect(window.location.search).not.toContain("t=");
  });

  it("prefers ?t= over stored token", async () => {
    loadPlayerToken.mockReturnValue("old-token");
    renderPlayPage("/play/K7X2PQ?t=new-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("player-shell")).toBeTruthy();
    });
    expect(createSyncedTableStore).toHaveBeenCalledWith(
      expect.objectContaining({ token: "new-token" }),
    );
  });

  it("shows join form with message when ?t= token is invalid", async () => {
    renderPlayPage("/play/K7X2PQ?t=bad-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("player-name-input")).toBeTruthy();
    });
    expect(clearPlayerToken).toHaveBeenCalledWith("K7X2PQ");
    expect(screen.getByText(/join link is no longer valid/i)).toBeTruthy();
  });

  it("shows name counter and disables join for short names", async () => {
    renderPlayPage("/play/K7X2PQ");
    const input = await screen.findByTestId("player-name-input");
    fireEvent.input(input, { target: { value: "A" } });
    expect(screen.getByTestId("name-counter").textContent).toBe("1/16");
    expect(screen.getByTestId("join-btn")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("join-disabled-reason").textContent).toMatch(/2–16/);
  });

  it("enables join when name is valid", async () => {
    renderPlayPage("/play/K7X2PQ");
    const input = await screen.findByTestId("player-name-input");
    fireEvent.input(input, { target: { value: "Ana" } });
    expect(screen.getByTestId("name-counter").textContent).toBe("3/16");
    expect(screen.getByTestId("join-btn")).toHaveProperty("disabled", false);
  });

  it("disables taken colours and selects first available", async () => {
    vi.mocked(getTableMeta).mockResolvedValueOnce({
      exists: true,
      game: "baccarat",
      participation: { playerMode: "on", bank: "none", outcomeSource: "physical" },
      joiningOpen: true,
      takenColors: [PLAYER_COLORS[0]!],
    });
    renderPlayPage("/play/K7X2PQ");
    const takenSwatch = await screen.findByTestId(`color-${PLAYER_COLORS[0]}`);
    expect(takenSwatch).toHaveProperty("disabled", true);
    expect(screen.getByText("taken")).toBeTruthy();
    const availableSwatch = screen.getByTestId(`color-${PLAYER_COLORS[1]}`);
    expect(availableSwatch.className).toContain("play-page__swatch--selected");
  });
});
