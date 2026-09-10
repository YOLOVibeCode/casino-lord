/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStubModule, STUB_RULES } from "@casino-lord/core/testing";
import { rouletteModule } from "@casino-lord/game-roulette";
import { LocationProvider, Router } from "preact-iso";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import { DealerPage } from "./DealerPage.js";

let capturedModuleId = "";
vi.mock("../shells/DealerShell.js", () => ({
  DealerShell: (props: { module: { id: string } }) => {
    capturedModuleId = props.module.id;
    return <div data-testid="dealer-shell" data-module-id={props.module.id} />;
  },
}));

vi.mock("../sync/config.js", () => ({
  isSyncConfigured: () => true,
  getSyncBaseUrl: () => "http://127.0.0.1:3000",
}));

let readOnly = false;
const listeners = new Set<() => void>();

function setReadOnly(next: boolean): void {
  readOnly = next;
  for (const l of listeners) l();
}

function mockSyncStore(game: "baccarat" | "roulette" = "baccarat"): SyncStore {
  const module =
    game === "roulette" ? asUntypedModule(rouletteModule) : asUntypedModule(createStubModule());
  const store = createTableStore({
    game,
    module,
    rules: game === "roulette" ? module.defaultRules : STUB_RULES,
    rng: () => 0,
    now: () => "2026-01-01T00:00:00.000Z",
    id: () => "s1",
  });
  return Object.assign(store, {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getConnectionState: () => "connected" as const,
    getPresence: () => ({ dealers: 1, displays: 0, players: [] }),
    isReadOnly: () => readOnly,
    getRejectReason: () => null,
    takeover: () => undefined,
    destroy: () => undefined,
    getDealerToken: () => "test-token",
    getModule: () => module,
  });
}

let mockGame: "baccarat" | "roulette" = "baccarat";
vi.mock("../table/synced-store.js", () => ({
  createSyncedTableStore: () => mockSyncStore(mockGame),
  waitForSyncReady: () => Promise.resolve(),
}));

function renderPage(path: string) {
  window.history.replaceState({}, "", path);
  return render(
    <LocationProvider>
      <Router>
        <DealerPage path="/dealer/:code" />
      </Router>
    </LocationProvider>,
  );
}

describe("DealerPage", () => {
  afterEach(() => {
    mockGame = "baccarat";
    capturedModuleId = "";
    cleanup();
  });

  it("renders dealer shell when sync store connects", async () => {
    renderPage("/dealer/ABCD23?t=test-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("dealer-shell")).toBeTruthy();
    });
  });

  it("shows the demoted banner when the store becomes read-only", async () => {
    setReadOnly(false);
    renderPage("/dealer/ABCD23?t=test-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("dealer-shell")).toBeTruthy();
    });
    expect(screen.queryByTestId("demoted-banner")).toBeNull();
    setReadOnly(true);
    await vi.waitFor(() => {
      expect(screen.getByTestId("demoted-banner")).toBeTruthy();
    });
  });

  it("passes the roulette module for a roulette table", async () => {
    mockGame = "roulette";
    renderPage("/dealer/ABCD23?t=test-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("dealer-shell")).toBeTruthy();
    });
    expect(capturedModuleId).toBe("roulette");
    expect(screen.getByTestId("dealer-shell").getAttribute("data-module-id")).toBe("roulette");
    const composed = mockSyncStore("roulette").getComposed().module as Record<string, unknown>;
    expect(composed).not.toHaveProperty("playerTotal");
    expect(composed).not.toHaveProperty("bankerTotal");
  });
});
