/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationProvider } from "preact-iso";
import { DEFAULT_TABLE_SETTINGS, type TableEvent } from "@casino-lord/core";
import { createStubModule, STUB_RULES } from "@casino-lord/core/testing";
import { crapsModule, DEFAULT_CRAPS_RULES } from "@casino-lord/game-craps";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore, type TableStore } from "../table/store.js";
import { UiProviders } from "../ui/test-providers.js";
import { DealerShell } from "./DealerShell.js";

vi.mock("../sync/urls.js", () => ({
  tableUrl: (path: string) => `http://127.0.0.1:3000${path}`,
}));

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

describe("DealerShell", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

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

  it("virtual table shows DEAL button, commitment prefix, and emits virtual op", () => {
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
    fireEvent.click(screen.getByTestId("deal-btn"));
    expect(sendVirtual).toHaveBeenCalledWith("trigger");
  });

  it("shows assigned shooter name for craps table", () => {
    const module = asUntypedModule(crapsModule);
    const store = createTableStore({
      game: "craps",
      module,
      rules: DEFAULT_CRAPS_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    store.emit({
      type: "PLAYER_JOINED",
      player: {
        id: "p1",
        name: "Ana",
        color: "#E53935",
        status: "active",
        joinedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    renderDealerShell({
      store,
      module,
      rules: DEFAULT_CRAPS_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    expect(screen.getByTestId("dealer-shooter-name").textContent).toBe("Shooter: Ana");
  });

  it("import shows player and bet counts from export envelope", async () => {
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    const exportText = [
      "#casino-lord v3 game=baccarat table=TEST01 series=1 started=2026-01-01T00:00:00.000Z source=physical rules=eyJ0aHJlc2hvbGQiOjEwfQ",
      "15",
      "#players",
      "p1 Ana issued=500 net=0 final=500",
      "#bets",
      "r1 p1 high 100 win 100",
    ].join("\n");

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    openDealerMenu();
    fireEvent.click(screen.getByTestId("menu-import"));
    fireEvent.input(screen.getByTestId("prompt-sheet-input"), { target: { value: exportText } });

    await waitFor(() => {
      expect(screen.getByTestId("prompt-sheet-preview").textContent).toBe(
        "1 players, 1 bets — not imported",
      );
    });

    fireEvent.click(screen.getByTestId("prompt-sheet-confirm"));

    await waitFor(() => {
      expect(store.events.filter((e) => e.type === "RESULT_RECORDED")).toHaveLength(1);
      expect(screen.getByTestId("dealer-toast").textContent).toContain(
        "1 players, 1 bets in this export — not imported",
      );
    });
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

    openDealerMenu();
    fireEvent.click(screen.getByTestId("menu-disconnect"));

    expect(onDisconnect).toHaveBeenCalled();
    expect(store.events.some((e) => e.type === "SESSION_ENDED")).toBe(false);
  });

  it("ends session after destructive hold-to-confirm", async () => {
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
    fireEvent.click(screen.getByTestId("menu-end-session"));
    expect(screen.getByTestId("confirm-sheet")).toBeTruthy();

    const confirmBtn = screen.getByTestId("confirm-sheet-confirm");
    fireEvent.pointerDown(confirmBtn);
    await vi.advanceTimersByTimeAsync(650);
    fireEvent.pointerUp(confirmBtn);

    await waitFor(() => {
      expect(store.events.some((e) => e.type === "SESSION_ENDED")).toBe(true);
    });
  });

  it("starts new series after confirm sheet", async () => {
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    const before = store.getTableMeta().seriesNumber;

    renderDealerShell({
      store,
      module,
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    openDealerMenu();
    fireEvent.click(screen.getByTestId("menu-new-series"));
    fireEvent.click(screen.getByTestId("confirm-sheet-confirm"));

    await waitFor(() => {
      expect(store.getTableMeta().seriesNumber).toBe(before + 1);
    });
  });
});
