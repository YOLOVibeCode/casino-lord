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

vi.mock("../hooks/use-device-settings.js", () => ({
  useDeviceSettings: () => [DEFAULT_DEVICE_SETTINGS, vi.fn()],
}));

let presence = { dealers: 0, displays: 1 };
const listeners = new Set<() => void>();

function setPresence(next: { dealers: number; displays: number }): void {
  presence = next;
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
    getPresence: () => presence,
    isReadOnly: () => false,
    getRejectReason: () => null,
    takeover: () => undefined,
    destroy: () => undefined,
    getDealerToken: () => null,
    getModule: () => module,
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
        <DisplayPage path="/display/:code" />
      </Router>
    </LocationProvider>,
  );
}

describe("DisplayPage", () => {
  afterEach(cleanup);

  it("renders display shell when sync store connects", async () => {
    renderPage("/display/ABCD23");
    await vi.waitFor(() => {
      expect(screen.getByTestId("display-shell")).toBeTruthy();
    });
    expect(screen.queryByTestId("waiting-for-dealer")).toBeNull();
  });
});
