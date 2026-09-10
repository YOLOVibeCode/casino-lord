import type { CrapsResult, RollInfo } from "./types.js";
import { decisionLabel, formatFacePair } from "./views/dice-display.js";

export function describeCrapsResult(result: CrapsResult, rollInfo?: RollInfo): string {
  const base = formatFacePair(result.a, result.b);
  if (rollInfo && rollInfo.decision !== "none") {
    return `${base} — ${decisionLabel(rollInfo.decision).toLowerCase()}`;
  }
  return `${base} — ${result.total}`;
}

export function findCrapsRollInfo(moduleState: unknown, resultId: string): RollInfo | undefined {
  const shooter = (moduleState as { shooter?: { rolls?: Array<{ id: string; info: RollInfo }> } })
    .shooter;
  return shooter?.rolls?.find((r) => r.id === resultId)?.info;
}
