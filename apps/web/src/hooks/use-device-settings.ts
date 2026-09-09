import { useCallback, useState } from "preact/hooks";
import {
  DEFAULT_DEVICE_SETTINGS,
  loadDeviceSettings,
  saveDeviceSettings,
  type DeviceSettings,
} from "../settings/device-settings.js";

export function useDeviceSettings(): [DeviceSettings, (next: DeviceSettings) => void] {
  const [settings, setSettings] = useState<DeviceSettings>(() => loadDeviceSettings());

  const update = useCallback((next: DeviceSettings) => {
    saveDeviceSettings(next);
    setSettings(next);
  }, []);

  return [settings, update];
}

export { DEFAULT_DEVICE_SETTINGS };
