/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStubModule, houseSettings, STUB_RULES } from "@casino-lord/core/testing";
import { rouletteModule } from "@casino-lord/game-roulette";
import { LocationProvider, Router } from "preact-iso";
import { SYNC_JOIN_TIMEOUT } from "../sync/error-copy.js";
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

const route = vi.fn();
vi.mock("preact-iso", async (importOriginal) => {
  const orig = await importOriginal<typeof import("preact-iso")>();
  return {
    ...orig,
    useLocation: () => ({ route }),
  };
});

let readOnly = false;
let waitForResult: Error | null = null;
let withLocalLog = false;
const listeners = new Set<() => void>();
const takeover = vi.fn();

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
    getPresence: () => ({ dealers: 1, displays: 0, players: [] }),
    isReadOnly: () => readOnly,
    getRejectReason: () => null,
    takeover,
    destroy: vi.fn(),
    getDealerToken: () => "test-token",
    getModule: () => module,
  });
}

let mockGame: "baccarat" | "roulette" = "baccarat";
vi.mock("../table/synced-store.js", () => ({
  createSyncedTableStore: () => mockSyncStore(mockGame),
  waitForSyncReady: () => (waitForResult ? Promise.reject(waitForResult) : Promise.resolve()),
}));

function renderPage(path: string) {
  window.history.replaceState({}, "", path);
  route.mockClear();
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
    cleanup();
    readOnly = false;
    waitForResult = null;
    withLocalLog = false;
    mockGame = "baccarat";
    capturedModuleId = "";
    takeover.mockClear();
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

  it("renders shell from local log on join timeout", async () => {
    joinTimeout = true;
    renderPage("/dealer/ABCD23?t=test-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("reconnect-banner")).toBeTruthy();
      expect(screen.getByTestId("dealer-shell")).toBeTruthy();
    });
    expect(screen.queryByTestId("sync-error-page")).toBeNull();
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

  it("shows dealer-active card when another dealer is connected", async () => {
    waitForResult = new Error("DEALER_ACTIVE");
    renderPage("/dealer/ABCD23?t=test-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("dealer-active-card")).toBeTruthy();
    });
    expect(screen.getByTestId("dealer-takeover-btn")).toBeTruthy();
    expect(screen.getByTestId("dealer-open-display-btn")).toBeTruthy();
    expect(route).not.toHaveBeenCalledWith(expect.stringContaining("/sync-error"));
  });

  it("calls takeover when Take over is clicked", async () => {
    waitForResult = new Error("DEALER_ACTIVE");
    renderPage("/dealer/ABCD23?t=test-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("dealer-takeover-btn")).toBeTruthy();
    });
    waitForResult = null;
    fireEvent.click(screen.getByTestId("dealer-takeover-btn"));
    await vi.waitFor(() => {
      expect(takeover).toHaveBeenCalled();
    });
  });

  it("navigates to display when Open as Display is clicked", async () => {
    waitForResult = new Error("DEALER_ACTIVE");
    renderPage("/dealer/ABCD23?t=test-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("dealer-open-display-btn")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("dealer-open-display-btn"));
    expect(route).toHaveBeenCalledWith("/display/ABCD23");
  });

  it("renders shell with reconnect bar on join timeout when local log exists", async () => {
    waitForResult = new Error(SYNC_JOIN_TIMEOUT);
    withLocalLog = true;
    renderPage("/dealer/ABCD23?t=test-token");
    await vi.waitFor(() => {
      expect(screen.getByTestId("dealer-shell")).toBeTruthy();
      expect(screen.getByTestId("reconnect-bar")).toBeTruthy();
    });
    expect(route).not.toHaveBeenCalledWith(expect.stringContaining("/sync-error"));
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
