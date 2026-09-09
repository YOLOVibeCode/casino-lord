/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStubModule, STUB_RULES } from "@casino-lord/core/testing";
import { LocationProvider, Router } from "preact-iso";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import { DealerPage } from "./DealerPage.js";

vi.mock("../shells/DealerShell.js", () => ({
  DealerShell: () => <div data-testid="dealer-shell">Dealer Shell</div>,
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

function mockSyncStore(): SyncStore {
  const module = asUntypedModule(createStubModule());
  const store = createTableStore({
    game: "baccarat",
    module,
    rules: STUB_RULES,
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
    getPresence: () => ({ dealers: 1, displays: 0 }),
    isReadOnly: () => readOnly,
    getRejectReason: () => null,
    takeover: () => undefined,
    destroy: () => undefined,
    getDealerToken: () => "test-token",
  });
}

vi.mock("../table/synced-store.js", () => ({
  createSyncedTableStore: () => mockSyncStore(),
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
  afterEach(cleanup);

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
});
