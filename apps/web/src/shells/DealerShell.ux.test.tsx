/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationProvider } from "preact-iso";
import { DEFAULT_TABLE_SETTINGS, type TableEvent } from "@casino-lord/core";
import { createStubModule, houseSettings, STUB_RULES } from "@casino-lord/core/testing";
import { baccaratModule, DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import type { BaccaratState } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore, type TableStore } from "../table/store.js";
import { UiProviders } from "../ui/test-providers.js";
import { DealerShell } from "./DealerShell.js";

vi.mock("../sync/urls.js", () => ({
  tableUrl: (path: string) => `http://127.0.0.1:3000${path}`,
}));

const baccarat = asUntypedModule(baccaratModule);

function renderDealerShell(props: Parameters<typeof DealerShell>[0]) {
  return render(
    <UiProviders>
      <LocationProvider>
        <DealerShell {...props} />
      </LocationProvider>
    </UiProviders>,
  );
}

function openDealerMenu(): void {
  fireEvent.click(screen.getByTestId("menu-btn"));
}

describe("DealerShell UX-2b", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows result recorded toast and undo last resultLabel", async () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => `id-${n}`,
    });

    renderDealerShell({
      store,
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    expect(screen.getByTestId("undo-btn").textContent).toContain("Undo last Hand");

    act(() => {
      store.emit({
        type: "LIVE_INPUT",
        payload: {
          slots: {
            P1: { rank: "7", suit: "H" },
            B1: { rank: "4", suit: "H" },
            P2: { rank: "K", suit: "H" },
            B2: { rank: "5", suit: "H" },
          },
        },
        source: "dealer",
      });
    });

    fireEvent.click(screen.getByTestId("confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("dealer-toast").textContent).toMatch(/recorded · Hand \d/);
    });
  });

  it("renders toolbar text labels and solo players hint", () => {
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    store.emit({ type: "PARTICIPATION_CHANGED", participation: houseSettings().participation });

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    expect(screen.getByText("Players")).toBeTruthy();
    expect(screen.getByText("Bank")).toBeTruthy();
    expect(screen.getByText("Menu")).toBeTruthy();
    expect(screen.getByTestId("players-btn").getAttribute("title")).toBe(
      "Local players are managed in the Solo page",
    );
  });

  it("export copies to clipboard and shows success toast", async () => {
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    store.record({ value: 15 }, { quick: false });

    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    openDealerMenu();
    fireEvent.click(screen.getByText("Export"));

    await waitFor(() => {
      expect(screen.getByTestId("dealer-toast").textContent).toContain("Export copied — 1 results");
    });
  });

  it("export opens prompt sheet when clipboard fails", async () => {
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    store.record({ value: 15 }, { quick: false });

    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    openDealerMenu();
    fireEvent.click(screen.getByText("Export"));

    await waitFor(() => {
      expect(screen.getByTestId("prompt-sheet")).toBeTruthy();
      expect((screen.getByTestId("prompt-sheet-input") as HTMLTextAreaElement).value).toContain(
        "15",
      );
    });
  });

  it("toasts sync reject reasons", async () => {
    const module = asUntypedModule(createStubModule());
    const baseStore = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    let rejectReason: string | null = null;
    const listeners = new Set<() => void>();
    const store = {
      ...baseStore,
      subscribe: (fn: () => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      getRejectReason: () => rejectReason,
      getConnectionState: () => "connected" as const,
      isReadOnly: () => false,
      getDealerToken: () => "token",
    };

    renderDealerShell({
      store: store as unknown as TableStore,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    rejectReason = "SESSION_ENDED";
    act(() => listeners.forEach((fn) => fn()));

    await waitFor(() => {
      expect(screen.getByTestId("dealer-toast").textContent).toContain(
        "Action failed — session ended",
      );
    });
  });

  it("void open bets emits BET_REMOVED for each open bet", async () => {
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
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
    store.emit({ type: "BETS_OPENED", roundId: "r1" });
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "high",
        amount: 50,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    openDealerMenu();
    fireEvent.click(screen.getByTestId("menu-void-bets"));
    const confirmBtn = screen.getByTestId("confirm-sheet-confirm");
    fireEvent.pointerDown(confirmBtn);
    await vi.advanceTimersByTimeAsync(650);
    fireEvent.pointerUp(confirmBtn);

    await waitFor(() => {
      const removed = store.events.filter((e) => e.type === "BET_REMOVED");
      expect(removed).toHaveLength(1);
      expect(removed[0]).toMatchObject({ type: "BET_REMOVED", betId: "b1", by: "dealer" });
    });
  });

  it("closes menu on Escape and ignores Z in text inputs", () => {
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    openDealerMenu();
    expect(screen.getByTestId("menu-backdrop")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("menu-backdrop")).toBeNull();

    openDealerMenu();
    fireEvent.click(screen.getByTestId("menu-import"));
    const input = screen.getByTestId("prompt-sheet-input");
    const before = store.events.filter((e) => e.type === "RESULT_UNDONE").length;
    fireEvent.keyDown(input, { key: "z" });
    expect(store.events.filter((e) => e.type === "RESULT_UNDONE").length).toBe(before);
  });

  it("shows Deal now only while awaiting virtual trigger", () => {
    const module = asUntypedModule(createStubModule());
    const baseStore = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    const sendVirtual = vi.fn();
    const events: TableEvent[] = [
      {
        seq: 1,
        at: "2026-01-01T00:00:00.000Z",
        type: "TABLE_CREATED",
        game: "baccarat",
        participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
        settings: DEFAULT_TABLE_SETTINGS,
      },
      {
        seq: 2,
        at: "2026-01-01T00:00:01.000Z",
        type: "SERIES_STARTED",
        seriesId: "s1",
        commit: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      },
    ];
    const store: TableStore = {
      ...baseStore,
      get events() {
        return events;
      },
      getComposed: () => ({
        ...baseStore.getComposed(),
        platform: {
          ...baseStore.getComposed().platform,
          participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
        },
      }),
      sendVirtual,
      getVirtualStatus: () => ({ awaiting: "trigger" as const }),
      getVirtualPending: () => null,
    };

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    expect(screen.getByTestId("force-btn").textContent).toBe("Deal now");
    fireEvent.click(screen.getByTestId("force-btn"));
    expect(sendVirtual).toHaveBeenCalledWith("force");

    cleanup();
    const storeAction: TableStore = {
      ...store,
      getVirtualStatus: () => ({ awaiting: "action" as const }),
    };
    renderDealerShell({
      store: storeAction,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });
    expect(screen.queryByTestId("force-btn")).toBeNull();
  });
});
