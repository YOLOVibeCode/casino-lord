/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ROULETTE_RULES, rouletteModule } from "@casino-lord/game-roulette";
import { houseSettings } from "@casino-lord/core/testing";
import { LocationProvider, Router } from "preact-iso";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore, type TableStore } from "../table/store.js";
import { SoloPage } from "./SoloPage.js";

vi.mock("../shells/DealerShell.js", () => ({
  DealerShell: () => <div data-testid="dealer-shell">Dealer Shell</div>,
}));

vi.mock("../shells/DisplayShell.js", () => ({
  DisplayShell: () => <div data-testid="display-shell">Display Shell</div>,
}));

vi.mock("../sync/qr.js", () => ({
  qrDataUrl: (url: string) => Promise.resolve(`data:image/png;base64,${url}`),
}));

const roulette = asUntypedModule(rouletteModule);

const soloStoreRef = vi.hoisted(() => ({ current: null as TableStore | null }));

vi.mock("../table/solo-table.js", () => ({
  resolveSoloTableStore: () => {
    if (!soloStoreRef.current) {
      soloStoreRef.current = createTableStore({
        game: "roulette",
        module: roulette,
        rules: DEFAULT_ROULETTE_RULES,
        rng: () => 0,
        now: () => "2026-01-01T00:00:00.000Z",
        id: () => "s1",
      });
    }
    return Promise.resolve(soloStoreRef.current);
  },
  createNewSoloTable: vi.fn(),
}));

class FakeBroadcastChannel {
  static registry = new Map<string, Set<FakeBroadcastChannel>>();

  readonly name: string;
  private listeners = new Set<(ev: MessageEvent) => void>();

  constructor(name: string) {
    this.name = name;
    if (!FakeBroadcastChannel.registry.has(name)) {
      FakeBroadcastChannel.registry.set(name, new Set());
    }
    FakeBroadcastChannel.registry.get(name)!.add(this);
  }

  postMessage(_data: unknown): void {}

  addEventListener(type: string, listener: (ev: MessageEvent) => void): void {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: (ev: MessageEvent) => void): void {
    if (type === "message") this.listeners.delete(listener);
  }

  close(): void {
    this.listeners.clear();
    FakeBroadcastChannel.registry.get(this.name)?.delete(this);
  }
}

function renderPage(path: string) {
  window.history.replaceState({}, "", path);
  return render(
    <LocationProvider>
      <Router>
        <SoloPage path="/solo/:game" />
      </Router>
    </LocationProvider>,
  );
}

describe("SoloPage roulette", () => {
  beforeEach(() => {
    soloStoreRef.current = null;
    FakeBroadcastChannel.registry.clear();
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
  });

  afterEach(() => cleanup());

  it("renders dealer and display shells at /solo/roulette", async () => {
    renderPage("/solo/roulette");
    await waitFor(() => {
      expect(screen.getByTestId("dealer-shell")).toBeTruthy();
      expect(screen.getByTestId("display-shell")).toBeTruthy();
    });
  });

  it("shows local players toggle when BroadcastChannel is available", async () => {
    renderPage("/solo/roulette");
    await waitFor(() => {
      expect(screen.getByTestId("local-players-toggle")).toBeTruthy();
    });
  });

  it("shows play and display links when local players is enabled", async () => {
    soloStoreRef.current = createTableStore({
      game: "roulette",
      module: roulette,
      rules: DEFAULT_ROULETTE_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    soloStoreRef.current.emit({
      type: "PARTICIPATION_CHANGED",
      participation: houseSettings().participation,
    });

    renderPage("/solo/roulette");

    await waitFor(() => {
      expect(screen.getByTestId("solo-local-links")).toBeTruthy();
      expect(screen.getByTestId("solo-play-link")).toBeTruthy();
      expect(screen.getByTestId("solo-display-link")).toBeTruthy();
      expect(screen.getByTestId("solo-play-qr")).toBeTruthy();
      expect(screen.getByTestId("solo-display-qr")).toBeTruthy();
    });
  });

  it("hides local players toggle when BroadcastChannel is unavailable", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    renderPage("/solo/roulette");
    await waitFor(() => {
      expect(screen.getByTestId("dealer-shell")).toBeTruthy();
    });
    expect(screen.queryByTestId("local-players-toggle")).toBeNull();
  });
});
