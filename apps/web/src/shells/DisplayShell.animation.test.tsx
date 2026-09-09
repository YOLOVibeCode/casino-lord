/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import { DisplayShell } from "./DisplayShell.js";

const baccarat = asUntypedModule(baccaratModule);

function quickResult(outcome: "P" | "B" | "T") {
  return {
    cards: null,
    outcome,
    playerTotal: outcome === "P" ? 7 : outcome === "T" ? 7 : 4,
    bankerTotal: outcome === "B" ? 8 : outcome === "T" ? 7 : 9,
    playerPair: false,
    bankerPair: false,
    natural: false,
  };
}

describe("DisplayShell animations", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not animate when mounting with existing history", () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
      id: () => `id-${n}`,
    });

    store.record(quickResult("B"), { quick: true });
    store.record(quickResult("P"), { quick: true });

    render(
      <DisplayShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    expect(screen.queryByTestId("animation-layer")).toBeNull();
  });

  it("schedules one main animation when a new result is recorded", async () => {
    vi.useFakeTimers();
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
      id: () => `id-${n}`,
    });

    render(
      <DisplayShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    await act(async () => {
      store.record(quickResult("B"), { quick: true });
    });

    expect(screen.getByTestId("animation-layer")).toBeTruthy();
    const mainSegments = document.querySelectorAll('[data-phase="main"]');
    expect(mainSegments.length).toBe(1);
    expect(document.querySelector('[data-style="sweep"]')).toBeTruthy();
  });

  it("plays ANIMATION_PREVIEW for a single preview event", async () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
      id: () => `id-${n}`,
    });

    render(
      <DisplayShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    await act(async () => {
      store.emit({ type: "ANIMATION_PREVIEW", eventId: "player_win" });
    });

    expect(screen.getByTestId("animation-layer")).toBeTruthy();
    expect(document.querySelector('[data-style="sweep"][data-phase="main"]')).toBeTruthy();
  });

  it("holds board state when main animation blocks board update", async () => {
    vi.useFakeTimers();
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
      id: () => `id-${n}`,
    });

    store.record(quickResult("B"), { quick: true });

    render(
      <DisplayShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    await act(async () => {
      store.startNewSeries("Shoe 2");
    });

    expect(screen.getByTestId("animation-layer")).toBeTruthy();
    expect((store.getComposed().module as { results: unknown[] }).results.length).toBe(0);
    expect(document.querySelectorAll('[data-cell="occupied"]').length).toBeGreaterThan(0);
  });

  it("shows BANKER WINS when banker_win override uses banner template", async () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
      id: () => `id-${n}`,
    });

    store.emit({
      type: "SETTINGS_CHANGED",
      patch: {
        animations: {
          "game.banker_win": {
            enabled: true,
            style: "banner",
            durationMs: 1200,
            intensity: 2,
            text: "{outcome} WINS",
            sound: null,
            soundVolume: 0.6,
            blockBoardUpdate: false,
          },
        },
      },
    });

    render(
      <DisplayShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    await act(async () => {
      store.record(quickResult("B"), { quick: true });
    });

    expect(screen.getByText("BANKER WINS")).toBeTruthy();
    expect(document.querySelector('[data-style="banner"][data-phase="main"]')).toBeTruthy();
  });

  it("suppresses visuals when device animations setting is off", async () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
      id: () => `id-${n}`,
    });

    render(
      <DisplayShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={{ ...DEFAULT_DEVICE_SETTINGS, animations: false }}
      />,
    );

    await act(async () => {
      store.record(quickResult("P"), { quick: true });
    });

    expect(screen.queryByTestId("animation-layer")).toBeNull();
  });
});
