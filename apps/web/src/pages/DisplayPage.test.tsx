/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStubModule, houseSettings, STUB_RULES } from "@casino-lord/core/testing";
import { LocationProvider, Router } from "preact-iso";
import { SYNC_JOIN_TIMEOUT } from "../sync/error-copy.js";
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

vi.mock("../sync/urls.js", () => ({
  tableUrl: (path: string) => `http://127.0.0.1:3000${path}`,
}));

const route = vi.fn();
vi.mock("preact-iso", async (importOriginal) => {
  const orig = await importOriginal<typeof import("preact-iso")>();
  return {
    ...orig,
    useLocation: () => ({ route }),
  };
});

vi.mock("../hooks/use-device-settings.js", () => ({
  useDeviceSettings: () => [DEFAULT_DEVICE_SETTINGS, vi.fn()],
}));

let presence = { dealers: 0, displays: 1, players: [] as { id: string; connected: boolean }[] };
let waitForResult: Error | null = null;
let withLocalLog = false;
const listeners = new Set<() => void>();

function setPresence(next: { dealers: number; displays: number }): void {
  presence = { ...next, players: [] };
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
  if (withLocalLog) {
    const settings = houseSettings();
    store.emit({
      type: "TABLE_CREATED",
      game: "baccarat",
      participation: settings.participation,
      settings,
    });
  }
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
    destroy: vi.fn(),
    getDealerToken: () => null,
  });
}

vi.mock("../table/synced-store.js", () => ({
  createSyncedTableStore: () => mockSyncStore(),
  waitForSyncReady: () => (waitForResult ? Promise.reject(waitForResult) : Promise.resolve()),
}));

function renderPage(path: string) {
  window.history.replaceState({}, "", path);
  route.mockClear();
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
    cleanup();
    waitForResult = null;
    withLocalLog = false;
    setPresence({ dealers: 0, displays: 1 });
  });

  it("renders display shell and waiting-for-dealer hint", async () => {
    renderPage("/display/ABCD23");
    await vi.waitFor(() => {
      expect(screen.getByTestId("display-shell")).toBeTruthy();
      expect(screen.getByTestId("waiting-for-dealer")).toBeTruthy();
    });
  });

  it("hides the waiting hint once presence reports a dealer", async () => {
    setPresence({ dealers: 0, displays: 1 });
    renderPage("/display/ABCD23");
    await vi.waitFor(() => {
      expect(screen.getByTestId("waiting-for-dealer")).toBeTruthy();
    });
    setPresence({ dealers: 1, displays: 1 });
    await vi.waitFor(() => {
      expect(screen.queryByTestId("waiting-for-dealer")).toBeNull();
    });
  });

  it("renders shell with reconnect bar on join timeout when local log exists", async () => {
    waitForResult = new Error(SYNC_JOIN_TIMEOUT);
    withLocalLog = true;
    renderPage("/display/ABCD23");
    await vi.waitFor(() => {
      expect(screen.getByTestId("display-shell")).toBeTruthy();
      expect(screen.getByTestId("reconnect-bar")).toBeTruthy();
    });
    expect(route).not.toHaveBeenCalledWith(expect.stringContaining("/sync-error"));
  });
});
