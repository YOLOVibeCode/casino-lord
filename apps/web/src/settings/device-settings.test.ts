import { describe, expect, it, beforeEach } from "vitest";
import type { StorageLike } from "./storage.js";
import {
  DEFAULT_DEVICE_SETTINGS,
  loadDeviceSettings,
  saveDeviceSettings,
} from "./device-settings.js";

function createMemoryStore(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe("device settings", () => {
  let store: StorageLike;

  beforeEach(() => {
    store = createMemoryStore();
  });

  it("returns defaults when nothing stored", () => {
    expect(loadDeviceSettings(store)).toEqual(DEFAULT_DEVICE_SETTINGS);
  });

  it("round-trips through storage", () => {
    const custom = { ...DEFAULT_DEVICE_SETTINGS, confirmDelayMs: 1500, layoutId: "classic" };
    saveDeviceSettings(custom, store);
    expect(loadDeviceSettings(store)).toEqual(custom);
  });

  it("returns defaults for corrupt JSON", () => {
    store.setItem("casino-lord:device-settings", "{not json");
    expect(loadDeviceSettings(store)).toEqual(DEFAULT_DEVICE_SETTINGS);
  });

  it("no-ops save and returns defaults when store is null", () => {
    expect(loadDeviceSettings(null)).toEqual(DEFAULT_DEVICE_SETTINGS);
    expect(() => saveDeviceSettings(DEFAULT_DEVICE_SETTINGS, null)).not.toThrow();
  });

  it("round-trips theme and boardLanguage", () => {
    const custom = {
      ...DEFAULT_DEVICE_SETTINGS,
      theme: "midnight" as const,
      boardLanguage: "EN+ZH" as const,
    };
    saveDeviceSettings(custom, store);
    expect(loadDeviceSettings(store)).toEqual(custom);
  });

  it("defaults theme and boardLanguage when missing from stored JSON", () => {
    store.setItem(
      "casino-lord:device-settings",
      JSON.stringify({ layoutId: "classic", scale: 1.5 }),
    );
    expect(loadDeviceSettings(store)).toMatchObject({
      theme: "table-felt",
      boardLanguage: "EN",
      layoutId: "classic",
      scale: 1.5,
    });
  });

  it("defaults phoneAnimations and shakeSensitivity when missing from stored JSON", () => {
    store.setItem("casino-lord:device-settings", JSON.stringify({ layoutId: "classic" }));
    expect(loadDeviceSettings(store)).toMatchObject({
      phoneAnimations: "reduced",
      shakeSensitivity: "medium",
    });
  });

  it("round-trips phoneAnimations and shakeSensitivity", () => {
    const custom = {
      ...DEFAULT_DEVICE_SETTINGS,
      phoneAnimations: "off" as const,
      shakeSensitivity: "high" as const,
    };
    saveDeviceSettings(custom, store);
    expect(loadDeviceSettings(store)).toEqual(custom);
  });
});
