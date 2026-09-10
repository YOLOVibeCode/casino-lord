import { useCallback, useEffect, useState } from "preact/hooks";
import {
  applyDevicePresentation,
  DEFAULT_DEVICE_SETTINGS,
  loadDeviceSettings,
  saveDeviceSettings,
  type DeviceSettings,
} from "../settings/device-settings.js";

export function useDeviceSettings(): [DeviceSettings, (next: DeviceSettings) => void] {
  const [settings, setSettings] = useState<DeviceSettings>(() => loadDeviceSettings());

  useEffect(() => {
    applyDevicePresentation(settings);
  }, [settings]);

  const update = useCallback((next: DeviceSettings) => {
    saveDeviceSettings(next);
    applyDevicePresentation(next);
    setSettings(next);
  }, []);

  return [settings, update];
}

export { DEFAULT_DEVICE_SETTINGS };
