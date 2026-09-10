import type { RouletteRules } from "./rules.js";
import type { RouletteResult } from "./types.js";
import { formatPocket } from "./views/colors.js";
import { classifyPocket } from "./wheel.js";

export function describeRouletteResult(
  result: RouletteResult,
  rules: RouletteRules,
): string {
  if (result.pocket === null) return "No spin";
  const info = classifyPocket(result.pocket, rules);
  const color = info.color.charAt(0).toUpperCase() + info.color.slice(1);
  return `${formatPocket(result.pocket)} ${color}`;
}
