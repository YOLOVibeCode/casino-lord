/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useShakeToRoll } from "./use-shake-to-roll.js";

function fireMotion(x: number, y: number, z: number): void {
  const handler = (window as unknown as { __motionHandler?: (e: DeviceMotionEvent) => void })
    .__motionHandler;
  if (!handler) throw new Error("devicemotion handler not registered");
  handler({
    accelerationIncludingGravity: { x, y, z },
  } as DeviceMotionEvent);
}

describe("useShakeToRoll", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { __motionHandler?: (e: DeviceMotionEvent) => void })
      .__motionHandler;
  });

  it("fires onRoll when magnitude exceeds threshold", () => {
    const onRoll = vi.fn();
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      if (type === "devicemotion") {
        (window as unknown as { __motionHandler: (e: DeviceMotionEvent) => void }).__motionHandler =
          listener as (e: DeviceMotionEvent) => void;
      }
    });
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {});

    renderHook(() => useShakeToRoll(onRoll, true, 18));
    fireMotion(15, 15, 0);
    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it("does not fire when magnitude is below threshold", () => {
    const onRoll = vi.fn();
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      if (type === "devicemotion") {
        (window as unknown as { __motionHandler: (e: DeviceMotionEvent) => void }).__motionHandler =
          listener as (e: DeviceMotionEvent) => void;
      }
    });
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {});

    renderHook(() => useShakeToRoll(onRoll, true, 24));
    fireMotion(10, 10, 0);
    expect(onRoll).not.toHaveBeenCalled();
  });

  it("uses a lower threshold when sensitivity is high", () => {
    const onRoll = vi.fn();
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      if (type === "devicemotion") {
        (window as unknown as { __motionHandler: (e: DeviceMotionEvent) => void }).__motionHandler =
          listener as (e: DeviceMotionEvent) => void;
      }
    });
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {});

    renderHook(() => useShakeToRoll(onRoll, true, 12));
    fireMotion(9, 9, 0);
    expect(onRoll).toHaveBeenCalledTimes(1);
  });
});
