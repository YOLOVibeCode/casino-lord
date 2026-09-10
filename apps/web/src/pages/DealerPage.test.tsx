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

vi.mock("../sync/api.js", () => ({
  getTableMeta: vi.fn(async () => ({
    exists: true,
    game: "roulette",
    participation: { playerMode: "off", bank: "none", outcomeSource: "physical" },
  })),
}));

let joinError: string | null = null;
const createSyncedTableStoreMock = vi.fn((opts?: { onJoinError?: (code: string) => void }) => {
  if (joinError) {
    queueMicrotask(() => opts?.onJoinError?.(joinError!));
    return mockSyncStore();
  }
  return mockSyncStore();
});
const waitForSyncReadyMock = vi.fn(() => {
  if (joinError) return Promise.reject(new Error(joinError));
  return Promise.resolve();
});

vi.mock("../table/synced-store.js", () => ({
  createSyncedTableStore: (...args: unknown[]) => createSyncedTableStoreMock(...args),
  waitForSyncReady: (...args: unknown[]) => waitForSyncReadyMock(...args),
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
    joinError = null;
    cleanup();
  });

  it("renders dealer shell when sync store connects", async () => {
    renderPage("/dealer/ABCD23?t=test-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("dealer-shell")).toBeTruthy();
    });
  });

  it("passes the roulette module from table meta to the synced store", async () => {
    const { rouletteModule } = await import("@casino-lord/game-roulette");
    renderPage("/dealer/ABCD23?t=test-token");
    await vi.waitFor(() => {
      expect(createSyncedTableStoreMock).toHaveBeenCalled();
    });
    const call = createSyncedTableStoreMock.mock.calls[0]?.[0] as { module: { id: string } };
    expect(call.module.id).toBe(rouletteModule.id);
  });

  it("shows dealer-active card with takeover and display link", async () => {
    joinError = "DEALER_ACTIVE";
    renderPage("/dealer/ABCD23?t=test-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("dealer-active-card")).toBeTruthy();
    });
    expect(screen.getByText("Take over")).toBeTruthy();
    expect(screen.getByText("Open as Display")).toBeTruthy();
    const displayLink = screen.getByText("Open as Display") as HTMLAnchorElement;
    expect(displayLink.getAttribute("href")).toBe("/display/ABCD23");
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
