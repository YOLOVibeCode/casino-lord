import type { LayoutPreset } from "@casino-lord/core";

export interface DeviceSettings {
  layoutId: string;
  scale: number;
  expressMode: boolean;
  autoAdvance: boolean;
  confirmDelayMs: number;
  haptics: boolean;
  cursorHide: boolean;
  fullScreen: boolean;
}

const STORAGE_KEY = "casino-lord:device-settings";

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  layoutId: "classic",
  scale: 1,
  expressMode: true,
  autoAdvance: true,
  confirmDelayMs: 0,
  haptics: true,
  cursorHide: true,
  fullScreen: false,
};

export function loadDeviceSettings(): DeviceSettings {
  if (typeof localStorage === "undefined") return { ...DEFAULT_DEVICE_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DEVICE_SETTINGS };
    return { ...DEFAULT_DEVICE_SETTINGS, ...(JSON.parse(raw) as Partial<DeviceSettings>) };
  } catch {
    return { ...DEFAULT_DEVICE_SETTINGS };
  }
}

export function saveDeviceSettings(settings: DeviceSettings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resolveLayout(layouts: LayoutPreset[], layoutId: string): LayoutPreset {
  return (
    layouts.find((l) => l.id === layoutId) ?? layouts[0] ?? { id: "default", label: "Default" }
  );
}
