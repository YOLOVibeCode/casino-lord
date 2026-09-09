import type { Pocket } from "../types.js";
import type { RouletteRules } from "../rules.js";
import { classifyPocket } from "../wheel.js";

export function pocketColorClass(pocket: Pocket, rules: RouletteRules): "red" | "black" | "green" {
  return classifyPocket(pocket, rules).color;
}

export function formatPocket(pocket: Pocket): string {
  return String(pocket);
}
