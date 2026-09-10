export function tapHaptic(enabled: boolean): void {
  if (enabled && typeof navigator.vibrate === "function") {
    navigator.vibrate(10);
  }
}
