/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStubModule, STUB_RULES } from "@casino-lord/core/testing";
import { LocationProvider, Router } from "preact-iso";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import { DisplayPage } from "./DisplayPage.js";

vi.mock("../shells/DisplayShell.js", () => ({
  DisplayShell: () => <div data-testid="display-shell">Display Shell</div>,
}));

vi.mock("../sync/config.js", () => ({
  isSyncConfigured: () => true,
  getSyncBaseUrl: () => "http://127.0.0.1:3000",
}));

vi.mock("../sync/api.js", () => ({
  getTableMeta: vi.fn(async () => ({
    exists: true,
    game: "baccarat",
    participation: { playerMode: "off", bank: "none", outcomeSource: "physical" },
  })),
}));

vi.mock("../hooks/use-device-settings.js", () => ({
  useDeviceSettings: () => [DEFAULT_DEVICE_SETTINGS, vi.fn()],
}));

let joinTimeout = false;
const listeners = new Set<() => void>();

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
  if (joinTimeout) {
    store.emit({ type: "TABLE_CREATED", game: "baccarat", settings: {} as never });
  }
  return Object.assign(store, {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getConnectionState: () => "connected" as const,
    getPresence: () => ({ dealers: 0, displays: 1, players: [] }),
    isReadOnly: () => false,
    getRejectReason: () => null,
    takeover: () => undefined,
    destroy: () => undefined,
    getDealerToken: () => null,
  });
}

vi.mock("../table/synced-store.js", () => ({
  createSyncedTableStore: () => mockSyncStore(),
  waitForSyncReady: () =>
    joinTimeout ? Promise.reject(new Error("sync join timeout")) : Promise.resolve(),
}));

function renderPage(path: string) {
  window.history.replaceState({}, "", path);
  return render(
    <LocationProvider>
      <Router>
        <DisplayPage path="/display/:code" />
      </Router>
    </LocationProvider>,
  );
}

describe("DisplayPage", () => {
  afterEach(() => {
    joinTimeout = false;
    cleanup();
  });

  it("renders display shell without a page-level waiting banner", async () => {
    renderPage("/display/ABCD23");
    await vi.waitFor(() => {
      expect(screen.getByTestId("display-shell")).toBeTruthy();
    });
    expect(screen.queryByTestId("waiting-for-dealer")).toBeNull();
  });

  it("renders shell from local log on join timeout", async () => {
    joinTimeout = true;
    renderPage("/display/ABCD23");
    await vi.waitFor(() => {
      expect(screen.getByTestId("reconnect-banner")).toBeTruthy();
      expect(screen.getByTestId("display-shell")).toBeTruthy();
    });
  });
});
