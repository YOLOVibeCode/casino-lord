import type { Pocket, RouletteResult } from "./types.js";
import { isValidPocket } from "./wheel.js";
import type { RouletteRules } from "./rules.js";

export function exportToken(pocket: Pocket | null): string {
  if (pocket === null) return "-";
  if (pocket === "00") return "00";
  return String(pocket);
}

export function parseToken(
  token: string,
  rules: RouletteRules,
): RouletteResult | { error: string } {
  if (token === "-") return { pocket: null };
  if (token === "00") {
    if (rules.wheel === "american") return { pocket: "00" };
    return { error: `00 invalid for ${rules.wheel} wheel` };
  }
  const n = Number(token);
  if (!Number.isInteger(n) || n < 0 || n > 36) {
    return { error: `Invalid pocket token: ${token}` };
  }
  const pocket = n as Pocket;
  if (!isValidPocket(pocket, rules)) {
    return { error: `Pocket ${token} invalid for ${rules.wheel} wheel` };
  }
  return { pocket };
}

export function exportBody(results: RouletteResult[]): string {
  return results.map((r) => exportToken(r.pocket)).join(" ");
}

export function importBody(
  text: string,
  rules: RouletteRules,
): { results: RouletteResult[]; warnings: string[] } | { error: string } {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const results: RouletteResult[] = [];
  for (const token of tokens) {
    const parsed = parseToken(token, rules);
    if ("error" in parsed) return { error: parsed.error };
    results.push(parsed);
  }
  return { results, warnings: [] };
}
