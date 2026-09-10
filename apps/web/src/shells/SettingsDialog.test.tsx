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

  it("settings dialog css defines 44px touch targets and scroll-snap tabs", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), "settings-dialog.css");
    const css = readFileSync(cssPath, "utf8");
    expect(css).toContain("min-height: max(3rem, 44px)");
    expect(css).toContain("scroll-snap-type: x mandatory");
    expect(css).toContain("env(safe-area-inset-bottom)");
  });

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

  it("emits SETTINGS_CHANGED for bank settings", () => {
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

    fireEvent.click(screen.getByTestId("tab-bank"));
    const input = screen.getByTestId("bank-table-min");
    fireEvent.change(input, { target: { value: "10" } });

    const changed = store.events.find((e) => e.type === "SETTINGS_CHANGED");
    expect(changed?.type).toBe("SETTINGS_CHANGED");
    if (changed?.type === "SETTINGS_CHANGED") {
      expect(changed.patch.bank?.tableMin).toBe(10);
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

  it("calls onDeviceChange when theme changes", () => {
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
    fireEvent.change(screen.getByTestId("device-theme"), { target: { value: "midnight" } });

    expect(onDeviceChange).toHaveBeenCalledWith(expect.objectContaining({ theme: "midnight" }));
  });

  it("calls onDeviceChange when board language changes", () => {
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
    fireEvent.change(screen.getByTestId("device-board-language"), {
      target: { value: "EN+ZH" },
    });

    expect(onDeviceChange).toHaveBeenCalledWith(
      expect.objectContaining({ boardLanguage: "EN+ZH" }),
    );
  });

  it("calls onDeviceChange when animations toggled", () => {
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
        deviceSettings={{ ...DEFAULT_DEVICE_SETTINGS, animations: false }}
        onDeviceChange={onDeviceChange}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByText("Device"));
    fireEvent.click(screen.getByTestId("device-animations"));

    expect(onDeviceChange).toHaveBeenCalledWith(expect.objectContaining({ animations: true }));
  });

  it("emits SETTINGS_CHANGED for players settings", () => {
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

    fireEvent.click(screen.getByTestId("tab-players"));
    fireEvent.change(screen.getByTestId("players-max"), { target: { value: "30" } });

    const changed = store.events.find((e) => e.type === "SETTINGS_CHANGED");
    expect(changed?.type).toBe("SETTINGS_CHANGED");
    if (changed?.type === "SETTINGS_CHANGED") {
      expect(changed.patch.players?.maxPlayers).toBe(30);
    }
  });

  it("emits SETTINGS_CHANGED for chip denominations on blur", () => {
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

    fireEvent.click(screen.getByTestId("tab-bank"));
    const input = screen.getByTestId("bank-chip-denominations");
    fireEvent.change(input, { target: { value: "5, 25, 100" } });
    fireEvent.blur(input);

    const changed = store.events.find((e) => e.type === "SETTINGS_CHANGED");
    expect(changed?.type).toBe("SETTINGS_CHANGED");
    if (changed?.type === "SETTINGS_CHANGED") {
      expect(changed.patch.bank?.chipDenominations).toEqual([5, 25, 100]);
    }
  });

  it("does not emit SETTINGS_CHANGED for invalid chip denominations", () => {
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

    fireEvent.click(screen.getByTestId("tab-bank"));
    const input = screen.getByTestId("bank-chip-denominations");
    fireEvent.change(input, { target: { value: "bad,0" } });
    fireEvent.blur(input);

    const changed = store.events.filter((e) => e.type === "SETTINGS_CHANGED");
    expect(changed.length).toBe(0);
  });

  it("calls onDeviceChange when sounds toggled", () => {
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
    fireEvent.click(screen.getByTestId("device-sounds"));

    expect(onDeviceChange).toHaveBeenCalledWith(expect.objectContaining({ soundEnabled: true }));
  });

  it("emits PARTICIPATION_CHANGED when player mode toggled", () => {
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

    fireEvent.click(screen.getByTestId("participation-with-players"));

    const changed = store.events.find((e) => e.type === "PARTICIPATION_CHANGED");
    expect(changed?.type).toBe("PARTICIPATION_CHANGED");
    if (changed?.type === "PARTICIPATION_CHANGED") {
      expect(changed.participation.playerMode).toBe("on");
    }
  });

  it("disables participation controls when series has results", () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
      id: () => `id-${n}`,
    });

    store.record(
      {
        cards: null,
        outcome: "P",
        playerTotal: 7,
        bankerTotal: 4,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );

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

    expect(screen.getByTestId("participation-locked")).toBeTruthy();
    const fieldsets = screen.getByTestId("participation-settings").querySelectorAll("fieldset");
    expect(fieldsets.length).toBeGreaterThan(0);
    for (const fieldset of fieldsets) {
      expect(fieldset).toHaveProperty("disabled", true);
    }

    const before = store.events.length;
    fireEvent.click(screen.getByTestId("participation-with-players"));
    expect(store.events.length).toBe(before);
  });
});
