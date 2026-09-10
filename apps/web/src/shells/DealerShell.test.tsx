/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationProvider } from "preact-iso";
import { DEFAULT_TABLE_SETTINGS, type TableEvent } from "@casino-lord/core";
import { baccaratModule, DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import type { BaccaratState } from "@casino-lord/game-baccarat";
import { createStubModule, houseSettings, STUB_RULES } from "@casino-lord/core/testing";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore, type TableStore } from "../table/store.js";
import { DealerShell, SOLO_PLAYERS_HINT, describeReject } from "./DealerShell.js";

vi.mock("../sync/urls.js", () => ({
  tableUrl: (path: string) => `http://127.0.0.1:3000${path}`,
}));

function renderDealerShell(props: Parameters<typeof DealerShell>[0]) {
  return render(
    <LocationProvider>
      <DealerShell {...props} />
    </LocationProvider>,
  );
}

describe("DealerShell", () => {
  afterEach(() => cleanup());

  it("renders header and action bar with stub module", () => {
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

    expect(screen.getByTestId("dealer-shell")).toBeTruthy();
    expect(screen.getByTestId("undo-btn")).toBeTruthy();
    expect(screen.getByTestId("confirm-btn")).toBeTruthy();
    expect(screen.getByText(store.code)).toBeTruthy();
  });

  it("virtual table shows DEAL button, commitment prefix, Deal now when pending, and emits virtual op", () => {
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
      getVirtualPending: () => ({
        kind: "shoe",
        untilAt: new Date(Date.now() + 5000).toISOString(),
      }),
      sendVirtual,
    };

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    expect(screen.getByTestId("deal-btn")).toBeTruthy();
    expect(screen.getByTestId("virtual-commit").textContent).toContain("abcdef01");
    expect(screen.getByTestId("force-btn").textContent).toBe("Deal now");
    fireEvent.click(screen.getByTestId("deal-btn"));
    expect(sendVirtual).toHaveBeenCalledWith("trigger");
  });

  it("disconnect navigates away without ending session", () => {
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    const onDisconnect = vi.fn();

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
      onDisconnect,
    });

    fireEvent.click(screen.getByTestId("menu-btn"));
    fireEvent.click(screen.getByTestId("menu-disconnect"));

    expect(onDisconnect).toHaveBeenCalled();
    expect(store.events.some((e) => e.type === "SESSION_ENDED")).toBe(false);
  });

  it("undo button uses resultLabel in label text", () => {
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

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    expect(screen.getByTestId("undo-btn").textContent).toMatch(/Undo last Round/i);
  });

  it("shows recorded toast after confirming a complete hand", () => {
    const baccarat = asUntypedModule(baccaratModule);
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
    expect(screen.getByTestId("dealer-toast").textContent).toMatch(/Hand 1 recorded/i);
  });

  it("toolbar shows icon labels for Players, Bank, and Menu", () => {
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
  });

  it("disabled Players button exposes solo hint", () => {
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

    expect(screen.getByTestId("players-btn").getAttribute("title")).toBe(SOLO_PLAYERS_HINT);
  });

  describe("export", () => {
    beforeEach(() => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });
    });

    it("shows success toast when clipboard write succeeds", async () => {
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

      fireEvent.click(screen.getByTestId("menu-btn"));
      await act(async () => {
        fireEvent.click(screen.getByTestId("menu-export"));
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(screen.getByTestId("dealer-toast").textContent).toMatch(/copied to clipboard/i);
    });

    it("shows inline prompt when clipboard write fails", async () => {
      vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error("denied"));
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

      fireEvent.click(screen.getByTestId("menu-btn"));
      await act(async () => {
        fireEvent.click(screen.getByTestId("menu-export"));
      });

      expect(screen.getByTestId("inline-prompt")).toBeTruthy();
      expect(screen.getByTestId("inline-prompt-input")).toBeTruthy();
    });
  });

  it("shows sync reject toast when getRejectReason is set", () => {
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
    const store: TableStore = {
      ...baseStore,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getRejectReason: () => rejectReason,
      getConnectionState: () => "connected" as const,
      isReadOnly: () => false,
      getDealerToken: () => "token",
      getPresence: () => ({ dealers: 1, displays: 0, players: [] }),
      getVirtualStatus: () => null,
      getVirtualPending: () => null,
      takeover: () => {},
      destroy: () => {},
      getPlayerId: () => null,
      getPendingPlayers: () => [],
      sendAdmit: () => {},
    };

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    act(() => {
      rejectReason = "SESSION_ENDED";
      listeners.forEach((l) => l());
    });

    expect(screen.getByTestId("dealer-toast").textContent).toMatch(
      describeReject("SESSION_ENDED"),
    );
  });

  it("menu backdrop closes the menu", () => {
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

    fireEvent.click(screen.getByTestId("menu-btn"));
    expect(screen.getByTestId("menu-disconnect")).toBeTruthy();
    fireEvent.click(screen.getByTestId("menu-backdrop"));
    expect(screen.queryByTestId("menu-disconnect")).toBeNull();
  });

  it("menu button reflects aria-expanded", () => {
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

    const menuBtn = screen.getByTestId("menu-btn");
    expect(menuBtn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(menuBtn);
    expect(menuBtn.getAttribute("aria-expanded")).toBe("true");
  });

  it("virtual table shows a single verify link", () => {
    const module = asUntypedModule(createStubModule());
    const baseStore = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    const store: TableStore = {
      ...baseStore,
      getComposed: () => ({
        ...baseStore.getComposed(),
        platform: {
          ...baseStore.getComposed().platform,
          participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
        },
      }),
    };

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    fireEvent.click(screen.getByTestId("menu-btn"));
    expect(screen.getAllByTestId("menu-verify")).toHaveLength(1);
    expect(screen.queryByTestId("menu-export-verify")).toBeNull();
  });

  it("keyboard shortcuts ignore typing targets", () => {
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

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: "z" });
    expect(screen.getByTestId("undo-btn").textContent).toMatch(/^Undo last Round$/);
    document.body.removeChild(input);
  });

  it("N key opens inline confirm for new series", () => {
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

    fireEvent.keyDown(window, { key: "N" });
    expect(screen.getByTestId("inline-confirm")).toBeTruthy();
    expect(screen.getByTestId("inline-confirm").textContent).toMatch(/new Session/i);
  });
});
