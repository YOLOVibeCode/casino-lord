import type { ResultEnvelope } from "./data-model.js";
import type { PlatformState } from "./platform-state.js";

export function getCurrentSeriesResults(
  platform: PlatformState,
): readonly ResultEnvelope<unknown>[] {
  return platform.currentSeriesResults;
}
