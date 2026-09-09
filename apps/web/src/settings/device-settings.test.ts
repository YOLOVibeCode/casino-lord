/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_DEVICE_SETTINGS,
  loadDeviceSettings,
  saveDeviceSettings,
} from "./device-settings.js";

describe("device settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when nothing stored", () => {
    expect(loadDeviceSettings()).toEqual(DEFAULT_DEVICE_SETTINGS);
  });

  it("round-trips through localStorage", () => {
    const custom = { ...DEFAULT_DEVICE_SETTINGS, confirmDelayMs: 1500, layoutId: "classic" };
    saveDeviceSettings(custom);
    expect(loadDeviceSettings()).toEqual(custom);
  });
});
