import { useEffect, useRef } from "preact/hooks";

export const DEFAULT_THRESHOLD = 18;
const DEBOUNCE_MS = 1000;

function motionMagnitude(e: DeviceMotionEvent): number {
  const acc = e.accelerationIncludingGravity;
  if (!acc) return 0;
  const x = acc.x ?? 0;
  const y = acc.y ?? 0;
  const z = acc.z ?? 0;
  return Math.sqrt(x * x + y * y + z * z);
}

export function useShakeToRoll(
  onRoll: () => void,
  enabled: boolean,
  threshold = DEFAULT_THRESHOLD,
): void {
  const lastFireRef = useRef(0);
  const onRollRef = useRef(onRoll);
  onRollRef.current = onRoll;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: DeviceMotionEvent) => {
      if (motionMagnitude(e) <= threshold) return;
      const now = Date.now();
      if (now - lastFireRef.current < DEBOUNCE_MS) return;
      lastFireRef.current = now;
      navigator.vibrate?.(10);
      onRollRef.current();
    };

    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, [enabled, threshold]);
}

export async function requestMotionPermission(): Promise<void> {
  if (typeof DeviceMotionEvent === "undefined") return;
  const DME = DeviceMotionEvent as typeof DeviceMotionEvent & {
    requestPermission?: () => Promise<PermissionState>;
  };
  if (typeof DME.requestPermission === "function") {
    try {
      await DME.requestPermission();
    } catch {
      /* user denied or unsupported */
    }
  }
}
