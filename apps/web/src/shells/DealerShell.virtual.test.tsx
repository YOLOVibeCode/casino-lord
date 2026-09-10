/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LocationProvider } from "preact-iso";
import { DEFAULT_TABLE_SETTINGS, type ResultEnvelope, type TableEvent } from "@casino-lord/core";
import { createStubModule, STUB_RULES } from "@casino-lord/core/testing";
import { baccaratModule, DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { rouletteModule, DEFAULT_ROULETTE_RULES } from "@casino-lord/game-roulette";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore, type TableStore } from "../table/store.js";
import { UiProviders } from "../ui/test-providers.js";
import { DealerShell } from "./DealerShell.js";
import "./dealer-shell.css";

vi.mock("../sync/urls.js", () => ({
  tableUrl: (path: string) => `http://127.0.0.1:3000${path}`,
}));

const baccarat = asUntypedModule(baccaratModule);
const roulette = asUntypedModule(rouletteModule);

const BACCARAT_RESULT = {
  cards: {
    P1: { rank: "7", suit: "H" },
    P2: { rank: "K", suit: "S" },
    B1: { rank: "4", suit: "D" },
    B2: { rank: "5", suit: "C" },
  },
  outcome: "B",
  playerTotal: 7,
  bankerTotal: 9,
  playerPair: false,
  bankerPair: false,
  natural: true,
} as const;

function renderDealerShell(props: Parameters<typeof DealerShell>[0]) {
  return render(
    <UiProviders>
      <LocationProvider>
        <DealerShell {...props} />
      </LocationProvider>
    </UiProviders>,
  );
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width, writable: true });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
    writable: true,
  });
}

function openDealerMenu(): void {
  fireEvent.click(screen.getByTestId("menu-btn"));
}

function virtualBaseEvents(): TableEvent[] {
  return [
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
}

function makeVirtualStore(overrides: Partial<TableStore> = {}): TableStore {
  const module = asUntypedModule(createStubModule());
  const baseStore = createTableStore({
    game: "baccarat",
    module,
    rules: STUB_RULES,
    rng: () => 0,
    now: () => "2026-01-01T00:00:00.000Z",
    id: () => "s1",
  });
  const events = virtualBaseEvents();
  return {
    ...baseStore,
    get events() {
      return events;
    },
    getComposed: () => ({
      ...baseStore.getComposed(),
      platform: {
        ...baseStore.getComposed().platform,
        participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
        currentSeriesResults: [],
      },
    }),
    sendVirtual: vi.fn(),
    getVirtualStatus: () => ({ awaiting: "trigger" as const }),
    getVirtualPending: () => null,
    ...overrides,
  };
}

describe("DealerShell virtual panel", () => {
  afterEach(() => cleanup());

  it("shows reveal progress while virtualPending is set", () => {
    const events: TableEvent[] = [
      ...virtualBaseEvents(),
      {
        seq: 3,
        at: "2026-01-01T00:00:02.000Z",
        type: "RESULT_RECORDED",
        result: {
          id: "r0",
          index: 1,
          recordedAt: "2026-01-01T00:00:02.000Z",
          quick: false,
          source: "virtual",
          by: "system",
          data: {},
        },
      },
      {
        seq: 4,
        at: "2026-01-01T00:00:03.000Z",
        type: "LIVE_INPUT",
        payload: {},
        source: "system",
      },
      {
        seq: 5,
        at: "2026-01-01T00:00:04.000Z",
        type: "LIVE_INPUT",
        payload: {},
        source: "system",
      },
    ];
    const store = makeVirtualStore({
      get events() {
        return events;
      },
      getVirtualPending: () => ({
        kind: "shoe",
        untilAt: "2026-01-01T00:00:10.000Z",
      }),
    });

    renderDealerShell({
      store,
      module: asUntypedModule(createStubModule()),
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    expect(screen.getByTestId("virtual-reveal").textContent).toBe("Dealing… card 2 revealed");
  });

  it("shows reveal progress for shoe without virtualPending when LIVE_INPUT is in flight", () => {
    const events: TableEvent[] = [
      ...virtualBaseEvents(),
      {
        seq: 3,
        at: "2026-01-01T00:00:02.000Z",
        type: "RESULT_RECORDED",
        result: {
          id: "r0",
          index: 1,
          recordedAt: "2026-01-01T00:00:02.000Z",
          quick: false,
          source: "virtual",
          by: "system",
          data: {},
        },
      },
      {
        seq: 4,
        at: "2026-01-01T00:00:03.000Z",
        type: "LIVE_INPUT",
        payload: {},
        source: "system",
      },
    ];
    const baseStore = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
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
          currentSeriesResults: [
            {
              id: "r0",
              index: 1,
              recordedAt: "2026-01-01T00:00:02.000Z",
              quick: false,
              source: "virtual",
              by: "system",
              data: BACCARAT_RESULT,
            },
          ],
        },
      }),
      sendVirtual: vi.fn(),
      getVirtualStatus: () => ({ awaiting: "trigger" as const }),
      getVirtualPending: () => null,
    };

    renderDealerShell({
      store,
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    expect(screen.getByTestId("virtual-reveal").textContent).toBe("Dealing… card 1 revealed");
  });

  it("shows optimistic Dealing… immediately after DEAL before events arrive", () => {
    const sendVirtual = vi.fn();
    const baseStore = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    const store: TableStore = {
      ...baseStore,
      get events() {
        return virtualBaseEvents();
      },
      getComposed: () => ({
        ...baseStore.getComposed(),
        platform: {
          ...baseStore.getComposed().platform,
          participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
          currentSeriesResults: [],
        },
      }),
      sendVirtual,
      getVirtualStatus: () => ({ awaiting: "trigger" as const }),
      getVirtualPending: () => null,
    };

    renderDealerShell({
      store,
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    fireEvent.click(screen.getByTestId("deal-btn"));
    expect(sendVirtual).toHaveBeenCalledWith("trigger");
    expect(screen.getByTestId("virtual-reveal").textContent).toBe("Dealing…");
  });

  it("shows last result with ResultDetailView when idle", () => {
    const envelope: ResultEnvelope<typeof BACCARAT_RESULT> = {
      id: "r1",
      index: 1,
      recordedAt: "2026-01-01T00:00:02.000Z",
      quick: false,
      source: "virtual",
      by: "system",
      data: BACCARAT_RESULT,
    };
    const baseStore = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    const store: TableStore = {
      ...baseStore,
      get events() {
        return virtualBaseEvents();
      },
      getComposed: () => ({
        ...baseStore.getComposed(),
        platform: {
          ...baseStore.getComposed().platform,
          participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
          currentSeriesResults: [envelope],
        },
      }),
      sendVirtual: vi.fn(),
      getVirtualStatus: () => ({ awaiting: "trigger" as const }),
      getVirtualPending: () => null,
    };

    renderDealerShell({
      store,
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    expect(screen.getByTestId("virtual-last-result")).toBeTruthy();
    expect(screen.getByTestId("result-player-cards").textContent).toContain("7♥");
    expect(screen.getByText("NATURAL")).toBeTruthy();
  });

  it("shows baccarat empty state before any result", () => {
    const baseStore = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    const store: TableStore = {
      ...baseStore,
      get events() {
        return virtualBaseEvents();
      },
      getComposed: () => ({
        ...baseStore.getComposed(),
        platform: {
          ...baseStore.getComposed().platform,
          participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
          currentSeriesResults: [],
        },
      }),
      sendVirtual: vi.fn(),
      getVirtualStatus: () => ({ awaiting: "trigger" as const }),
      getVirtualPending: () => null,
    };

    renderDealerShell({
      store,
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    expect(screen.getByTestId("virtual-empty").textContent).toBe("No hands yet — tap DEAL");
  });

  it("shows roulette empty state before any result", () => {
    const baseStore = createTableStore({
      game: "roulette",
      module: roulette,
      rules: DEFAULT_ROULETTE_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    const store: TableStore = {
      ...baseStore,
      get events() {
        return virtualBaseEvents();
      },
      getComposed: () => ({
        ...baseStore.getComposed(),
        platform: {
          ...baseStore.getComposed().platform,
          participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
          currentSeriesResults: [],
        },
      }),
      sendVirtual: vi.fn(),
      getVirtualStatus: () => ({ awaiting: "trigger" as const }),
      getVirtualPending: () => null,
    };

    renderDealerShell({
      store,
      module: roulette,
      rules: DEFAULT_ROULETTE_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    expect(screen.getByTestId("virtual-empty").textContent).toBe("No spins yet — tap SPIN");
  });
});

describe("DealerShell virtual Force", () => {
  afterEach(() => cleanup());

  it("shows Force only when awaiting player action", () => {
    const sendVirtual = vi.fn();
    const storeTrigger = makeVirtualStore({
      sendVirtual,
      getVirtualStatus: () => ({ awaiting: "trigger" as const }),
    });

    renderDealerShell({
      store: storeTrigger,
      module: asUntypedModule(createStubModule()),
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });
    expect(screen.queryByTestId("force-btn")).toBeNull();

    cleanup();

    const storeAction = makeVirtualStore({
      sendVirtual,
      getVirtualStatus: () => ({
        awaiting: "action" as const,
        turnPrompt: "Seat 3 to act",
      }),
    });

    renderDealerShell({
      store: storeAction,
      module: asUntypedModule(createStubModule()),
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    const forceBtn = screen.getByTestId("force-btn");
    expect(forceBtn.textContent).toBe("Force — skip Seat 3 to act");
    expect(forceBtn.getAttribute("title")).toBe("Deals now even though it is a player's turn");
    fireEvent.click(forceBtn);
    expect(sendVirtual).toHaveBeenCalledWith("force");
  });

  it("uses trigger-specific Force fallback when turnPrompt is missing", () => {
    const baccaratBase = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    const baccaratStore: TableStore = {
      ...baccaratBase,
      get events() {
        return virtualBaseEvents();
      },
      getComposed: () => ({
        ...baccaratBase.getComposed(),
        platform: {
          ...baccaratBase.getComposed().platform,
          participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
          currentSeriesResults: [],
        },
      }),
      sendVirtual: vi.fn(),
      getVirtualStatus: () => ({ awaiting: "action" as const }),
      getVirtualPending: () => null,
    };

    renderDealerShell({
      store: baccaratStore,
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    expect(screen.getByTestId("force-btn").textContent).toBe("Force deal");

    cleanup();

    const rouletteBase = createTableStore({
      game: "roulette",
      module: roulette,
      rules: DEFAULT_ROULETTE_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    const rouletteStore: TableStore = {
      ...rouletteBase,
      get events() {
        return virtualBaseEvents();
      },
      getComposed: () => ({
        ...rouletteBase.getComposed(),
        platform: {
          ...rouletteBase.getComposed().platform,
          participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
          currentSeriesResults: [],
        },
      }),
      sendVirtual: vi.fn(),
      getVirtualStatus: () => ({ awaiting: "action" as const }),
      getVirtualPending: () => null,
    };

    renderDealerShell({
      store: rouletteStore,
      module: roulette,
      rules: DEFAULT_ROULETTE_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    expect(screen.getByTestId("force-btn").textContent).toBe("Force spin");
  });
});

describe("DealerShell menu scroll", () => {
  beforeAll(() => {
    const style = document.createElement("style");
    style.textContent = `
      .dealer-shell__menu-panel {
        max-height: calc(100dvh - 5.5rem - env(safe-area-inset-top, 0px));
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }
    `;
    document.head.appendChild(style);
  });

  afterEach(() => cleanup());

  it("exposes scrollable dealer menu panel at small viewport", () => {
    setViewport(375, 667);
    const store = makeVirtualStore();

    renderDealerShell({
      store,
      module: asUntypedModule(createStubModule()),
      rules: STUB_RULES,
      deviceSettings: DEFAULT_DEVICE_SETTINGS,
      onDeviceSettingsChange: () => {},
    });

    openDealerMenu();
    const panel = screen.getByTestId("dealer-menu-panel");
    const style = window.getComputedStyle(panel);
    expect(style.overflowY).toBe("auto");
    expect(style.maxHeight).not.toBe("");
    expect(panel.contains(screen.getByTestId("menu-disconnect"))).toBe(true);
  });
});
