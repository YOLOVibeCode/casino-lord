/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import { SettingsDialog } from "./SettingsDialog.js";

const baccarat = asUntypedModule(baccaratModule);

describe("SettingsDialog", () => {
  afterEach(() => cleanup());

  it("appends SETTINGS_CHANGED when prediction cells toggled", () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    render(
      <SettingsDialog
        store={store}
        module={baccarat}
        rules={store.getRules()}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
        onDeviceChange={() => {}}
        onClose={() => {}}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /Prediction cells/i });
    fireEvent.click(checkbox);

    const changed = store.events.find((e) => e.type === "SETTINGS_CHANGED");
    expect(changed?.type).toBe("SETTINGS_CHANGED");
    if (changed?.type === "SETTINGS_CHANGED") {
      expect((changed.patch.rules as { predictionCells: boolean }).predictionCells).toBe(true);
    }
  });

  it("calls onDeviceChange when layout changes", () => {
    const onDeviceChange = vi.fn();
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    render(
      <SettingsDialog
        store={store}
        module={baccarat}
        rules={store.getRules()}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
        onDeviceChange={onDeviceChange}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByText("Device"));
    fireEvent.change(screen.getByTestId("device-layout"), {
      target: { value: "roads-only" },
    });

    expect(onDeviceChange).toHaveBeenCalledWith(
      expect.objectContaining({ layoutId: "roads-only" }),
    );
  });
});
