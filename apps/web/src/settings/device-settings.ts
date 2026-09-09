import type { LayoutPreset } from "@casino-lord/core";
import { browserStorage, type StorageLike } from "./storage.js";

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

export function loadDeviceSettings(store: StorageLike | null = browserStorage()): DeviceSettings {
  if (!store) return { ...DEFAULT_DEVICE_SETTINGS };
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DEVICE_SETTINGS };
    return { ...DEFAULT_DEVICE_SETTINGS, ...(JSON.parse(raw) as Partial<DeviceSettings>) };
  } catch {
    return { ...DEFAULT_DEVICE_SETTINGS };
  }
}

export function saveDeviceSettings(
  settings: DeviceSettings,
  store: StorageLike | null = browserStorage(),
): void {
  if (!store) return;
  store.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resolveLayout(layouts: LayoutPreset[], layoutId: string): LayoutPreset {
  return (
    layouts.find((l) => l.id === layoutId) ?? layouts[0] ?? { id: "default", label: "Default" }
  );
}
