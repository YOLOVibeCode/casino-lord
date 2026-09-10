/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { useDeviceSettings } from "./use-device-settings.js";

describe("useDeviceSettings", () => {
  it("applies theme and boardLanguage to documentElement on update", () => {
    const { result } = renderHook(() => useDeviceSettings());

    act(() => {
      result.current[1]({
        ...DEFAULT_DEVICE_SETTINGS,
        theme: "crimson",
        boardLanguage: "EN+ZH",
      });
    });

    expect(document.documentElement.dataset.theme).toBe("crimson");
    expect(document.documentElement.dataset.boardLanguage).toBe("EN+ZH");
  });
});
