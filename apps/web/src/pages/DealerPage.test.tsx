/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
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
    getConnectionState: () => "connected" as const,
    getPresence: () => ({ dealers: 1, displays: 0 }),
    isReadOnly: () => false,
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
  it("renders dealer shell when sync store connects", async () => {
    renderPage("/dealer/ABCD23?t=test-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("dealer-shell")).toBeTruthy();
    });
  });
});
