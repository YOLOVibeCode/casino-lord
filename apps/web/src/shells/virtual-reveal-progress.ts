import type { TableEvent } from "@casino-lord/core";
import type { VirtualPendingState } from "../table/sync-store-types.js";

export function countSystemLiveInputsSinceLastResult(events: readonly TableEvent[]): number {
  let startIndex = 0;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.type === "RESULT_RECORDED") {
      startIndex = i + 1;
      break;
    }
  }

  let count = 0;
  for (let i = startIndex; i < events.length; i += 1) {
    const event = events[i];
    if (event?.type === "LIVE_INPUT" && event.source === "system") {
      count += 1;
    }
  }
  return count;
}

export function revealProgressLabel(
  count: number,
  pendingKind: VirtualPendingState["kind"],
): string {
  if (pendingKind === "shoe") {
    return count > 0 ? `Dealing… card ${count} revealed` : "Dealing…";
  }
  if (pendingKind === "dice") {
    return count > 0 ? "Dealing… dice revealed" : "Dealing… rolling";
  }
  return count > 0 ? "Dealing… result incoming" : "Dealing… spinning";
}
