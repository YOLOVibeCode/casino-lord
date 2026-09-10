/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { baccaratModule, DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { houseSettings } from "@casino-lord/core/testing";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import { DisplayShell } from "./DisplayShell.js";

const baccarat = asUntypedModule(baccaratModule);

describe("DisplayShell a11y", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("announces settled results in the live region", () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    render(
      <DisplayShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    act(() => {
      store.record({ winner: "player", playerTotal: 9, bankerTotal: 4 }, { quick: false });
    });

    const live = screen.getByTestId("display-live-region");
    expect(live.textContent).toMatch(/Hand 1:/);
    expect(live.textContent?.length ?? 0).toBeGreaterThan(5);
  });

  it("announces betting countdown at 10 and 5 seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => new Date().toISOString(),
      id: () => "s1",
    });
    store.emit({ type: "PARTICIPATION_CHANGED", participation: houseSettings().participation });
    store.emit({
      type: "BETS_OPENED",
      roundId: "r1",
      closesAt: "2026-01-01T00:00:15.000Z",
    });

    render(
      <DisplayShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    const live = screen.getByTestId("display-live-region");
    expect(live.textContent).toContain("Bets close in 10 seconds");

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(live.textContent).toContain("Bets close in 5 seconds");
  });
});
