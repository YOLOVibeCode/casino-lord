import type { ConfirmState } from "@casino-lord/core";
import type { RouletteRules } from "./rules.js";
import type { RouletteState } from "./state.js";
import { classifyPocket } from "./wheel.js";
import type { Color, RouletteResult } from "./types.js";

const COLOR_HEX: Record<Color, string> = {
  red: "#D7263D",
  black: "#111318",
  green: "#1E8F4E",
};

function colorLabel(color: Color): string {
  return color.toUpperCase();
}

export function rouletteConfirm(
  state: RouletteState,
  rules: RouletteRules,
): ConfirmState<RouletteResult> | null {
  const pending = state.livePending;
  if (pending === null) return null;

  const info = classifyPocket(pending, rules);
  const badges: string[] = [];
  if (info.parity) badges.push(info.parity.toUpperCase());
  if (info.range) badges.push(info.range === "low" ? "LOW" : "HIGH");
  if (info.dozen)
    badges.push(`${info.dozen}${info.dozen === 1 ? "st" : info.dozen === 2 ? "nd" : "rd"} dozen`);
  if (info.column)
    badges.push(
      `${info.column}${info.column === 1 ? "st" : info.column === 2 ? "nd" : "rd"} column`,
    );
  if (rules.wheel === "french" && rules.zeroRule !== "none" && pending === 0) {
    badges.push(rules.zeroRule === "la_partage" ? "La partage applies" : "En prison applies");
  }

  const result: RouletteResult = { pocket: pending };
  return {
    label: `✓ CONFIRM ${String(pending)} ${colorLabel(info.color)}`,
    color: COLOR_HEX[info.color],
    ...(badges.length > 0 ? { badges } : {}),
    enabled: true,
    result,
  };
}
