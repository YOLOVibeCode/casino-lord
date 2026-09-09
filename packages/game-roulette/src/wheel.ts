import type { NumberInfo, Pocket, Sector } from "./types.js";
import { isEuropeanLayout, type RouletteRules } from "./rules.js";

export const RED_NUMBERS = new Set<number>([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export const EUROPEAN_WHEEL_ORDER: readonly Pocket[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

export const AMERICAN_WHEEL_ORDER: readonly Pocket[] = [
  0,
  28,
  9,
  26,
  30,
  11,
  7,
  20,
  32,
  17,
  5,
  22,
  34,
  15,
  3,
  24,
  36,
  13,
  1,
  "00",
  27,
  10,
  25,
  29,
  12,
  8,
  19,
  31,
  18,
  6,
  21,
  33,
  16,
  4,
  23,
  35,
  14,
  2,
] as const;

const VOISINS = new Set<Pocket>([22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25]);

const JEUX_ZERO = new Set<Pocket>([12, 35, 3, 26, 0, 32, 15]);

const TIERS = new Set<Pocket>([27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33]);

const ORPHELINS = new Set<Pocket>([17, 34, 6, 1, 20, 14, 31, 9]);

export function pocketKey(pocket: Pocket): string {
  return pocket === "00" ? "00" : String(pocket);
}

export function wheelOrder(rules: RouletteRules): readonly Pocket[] {
  return isEuropeanLayout(rules) ? EUROPEAN_WHEEL_ORDER : AMERICAN_WHEEL_ORDER;
}

export function wheelPockets(rules: RouletteRules): Pocket[] {
  return [...wheelOrder(rules)];
}

export function isValidPocket(pocket: Pocket, rules: RouletteRules): boolean {
  if (pocket === "00") return rules.wheel === "american";
  if (typeof pocket === "number" && pocket >= 0 && pocket <= 36) return true;
  return false;
}

function sectorForPocket(pocket: Pocket, rules: RouletteRules): Sector {
  if (!isEuropeanLayout(rules) || !rules.showSectors) return null;
  if (JEUX_ZERO.has(pocket)) return "zero";
  if (VOISINS.has(pocket)) return "voisins";
  if (TIERS.has(pocket)) return "tiers";
  if (ORPHELINS.has(pocket)) return "orphelins";
  return null;
}

export function classifyPocket(pocket: Pocket, rules: RouletteRules): NumberInfo {
  const order = wheelOrder(rules);
  const wheelIndex = order.indexOf(pocket);
  if (wheelIndex < 0) {
    throw new Error(`Invalid pocket ${String(pocket)} for wheel ${rules.wheel}`);
  }

  if (pocket === 0 || pocket === "00") {
    return {
      pocket,
      color: "green",
      parity: null,
      range: null,
      dozen: null,
      column: null,
      sector: sectorForPocket(pocket, rules),
      wheelIndex,
    };
  }

  if (typeof pocket !== "number") {
    throw new Error(`Expected number pocket, got ${String(pocket)}`);
  }
  const n = pocket;
  return {
    pocket: n,
    color: RED_NUMBERS.has(n) ? "red" : "black",
    parity: n % 2 === 0 ? "even" : "odd",
    range: n <= 18 ? "low" : "high",
    dozen: Math.ceil(n / 12) as 1 | 2 | 3,
    column: (((n - 1) % 3) + 1) as 1 | 2 | 3,
    sector: sectorForPocket(n, rules),
    wheelIndex,
  };
}

export function wheelNeighbours(pocket: Pocket, rules: RouletteRules, span = 2): Pocket[] {
  const order = wheelOrder(rules);
  const idx = order.indexOf(pocket);
  if (idx < 0) return [];
  const result: Pocket[] = [];
  for (let d = -span; d <= span; d++) {
    const i = (idx + d + order.length) % order.length;
    result.push(order[i]!);
  }
  return result;
}
