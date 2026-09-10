/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStubModule, houseSettings, STUB_RULES } from "@casino-lord/core/testing";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import { renderWithUiProviders } from "../ui/test-providers.js";
import { DealerShell } from "./DealerShell.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";

describe("BettingBar", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("emits BETS_OPENED when tapped in idle state", () => {
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "round-1",
    });
    store.emit({ type: "PARTICIPATION_CHANGED", participation: houseSettings().participation });

    renderWithUiProviders(
      <DealerShell
        store={store}
        module={module}
        rules={STUB_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
        onDeviceSettingsChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("betting-bar"));
    expect(store.events.some((e) => e.type === "BETS_OPENED")).toBe(true);
  });

  it("closes bets on timer expiry", () => {
    vi.useFakeTimers();
    const module = asUntypedModule(createStubModule());
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
      id: () => `id-${n}`,
    });
    const settings = {
      ...houseSettings(),
      betting: { betTimerSec: 5, autoOpenDelayMs: 0, autoCloseOnEntry: false },
    };
    store.emit({ type: "PARTICIPATION_CHANGED", participation: settings.participation });
    store.emit({ type: "SETTINGS_CHANGED", patch: settings });

    renderWithUiProviders(
      <DealerShell
        store={store}
        module={module}
        rules={STUB_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
        onDeviceSettingsChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("betting-bar"));
    vi.advanceTimersByTime(5000);
    const closed = store.events.find((e) => e.type === "BETS_CLOSED");
    expect(closed?.type).toBe("BETS_CLOSED");
    if (closed?.type === "BETS_CLOSED") expect(closed.by).toBe("timer");
  });
});
