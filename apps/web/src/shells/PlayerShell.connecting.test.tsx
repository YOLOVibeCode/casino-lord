/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { baccaratModule, DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import { UiProviders } from "../ui/test-providers.js";
import { PlayerShell } from "./PlayerShell.js";

vi.mock("../sync/urls.js", () => ({
  appBaseUrl: () => "http://table.local",
  tableUrl: (path: string) => `http://table.local${path}`,
}));

/**
 * A player who joined over HTTP while the live socket never connected: they have
 * a playerId, but the event log is empty, so the table has no TABLE_CREATED,
 * no participation and no players.
 */
function emptyLogStore(playerId: string | null): SyncStore {
  const module = asUntypedModule(baccaratModule);
  const store = createTableStore({
    game: "baccarat",
    module,
    rules: DEFAULT_BACCARAT_RULES,
    rng: () => 0,
    now: () => "2026-01-01T00:00:00.000Z",
    id: () => "s1",
  });
  store.events.length = 0;

  return Object.assign(store, {
    getConnectionState: () => "reconnecting" as const,
    getPresence: () => ({ dealers: 0, displays: 0, players: [] }),
    isReadOnly: () => false,
    getRejectReason: () => null,
    takeover: vi.fn(),
    destroy: vi.fn(),
    getDealerToken: () => null,
    getPlayerId: () => playerId,
    getPendingPlayers: () => [],
    sendAdmit: vi.fn(),
    getVirtualStatus: () => null,
    getVirtualPending: () => null,
  }) as unknown as SyncStore;
}

describe("PlayerShell with an empty event log", () => {
  afterEach(() => cleanup());

  it("renders a shell instead of nothing", () => {
    render(
      <UiProviders>
        <PlayerShell store={emptyLogStore("p-new")} playerName="Ana" />
      </UiProviders>,
    );

    // The phone must show something it can act on — never a blank page.
    expect(screen.getByTestId("player-shell")).toBeTruthy();
  });

  it("says it is still connecting rather than claiming the player was removed", () => {
    render(
      <UiProviders>
        <PlayerShell store={emptyLogStore("p-new")} playerName="Ana" />
      </UiProviders>,
    );

    const shell = screen.getByTestId("player-shell");
    expect(shell.textContent).toMatch(/connect/i);
    expect(shell.textContent).not.toMatch(/removed/i);
  });
});
