import type { Pocket } from "./types.js";
import { isEuropeanLayout, type RouletteRules } from "./rules.js";

export function columnOf(n: number): 1 | 2 | 3 {
  return (((n - 1) % 3) + 1) as 1 | 2 | 3;
}

export function rowOf(n: number): number {
  return Math.ceil(n / 3);
}

function sortPair(a: Pocket, b: Pocket): [Pocket, Pocket] {
  const key = (p: Pocket) => (p === "00" ? 37 : Number(p));
  return key(a) <= key(b) ? [a, b] : [b, a];
}

function pairKey(a: Pocket, b: Pocket): string {
  const [x, y] = sortPair(a, b);
  return `${String(x)}-${String(y)}`;
}

export function allStraights(rules: RouletteRules): Pocket[] {
  const pockets: Pocket[] = [0];
  if (!isEuropeanLayout(rules)) pockets.push("00");
  for (let n = 1; n <= 36; n++) pockets.push(n);
  return pockets;
}

export function allSplits(rules: RouletteRules): [Pocket, Pocket][] {
  const seen = new Set<string>();
  const splits: [Pocket, Pocket][] = [];

  const add = (a: Pocket, b: Pocket) => {
    const key = pairKey(a, b);
    if (!seen.has(key)) {
      seen.add(key);
      splits.push(sortPair(a, b));
    }
  };

  for (let n = 1; n <= 36; n++) {
    const col = columnOf(n);
    const row = rowOf(n);
    if (col < 3) add(n, n + 1);
    if (row < 12) add(n, n + 3);
  }

  if (isEuropeanLayout(rules)) {
    add(0, 1);
    add(0, 2);
    add(0, 3);
  } else {
    add(0, "00");
    add(0, 1);
    add(0, 2);
    add("00", 2);
    add("00", 3);
  }

  return splits;
}

export function allStreets(rules: RouletteRules): Pocket[][] {
  const streets: Pocket[][] = [];
  for (let row = 1; row <= 12; row++) {
    const base = (row - 1) * 3 + 1;
    streets.push([base, base + 1, base + 2]);
  }
  if (isEuropeanLayout(rules)) {
    streets.push([0, 1, 2], [0, 2, 3]);
  } else {
    streets.push([0, "00", 2], [0, 1, 2], ["00", 2, 3]);
  }
  return streets;
}

export function allCorners(rules: RouletteRules): Pocket[][] {
  const corners: Pocket[][] = [];
  const seen = new Set<string>();

  const add = (pockets: Pocket[]) => {
    const key = pockets.map(String).sort().join("-");
    if (!seen.has(key)) {
      seen.add(key);
      corners.push(pockets);
    }
  };

  for (let row = 1; row < 12; row++) {
    for (let col = 1; col <= 2; col++) {
      const n = (row - 1) * 3 + col;
      add([n, n + 1, n + 3, n + 4]);
    }
  }

  if (isEuropeanLayout(rules)) {
    add([0, 1, 2, 3]);
  } else {
    add([0, "00", 1, 2]);
    add([0, "00", 2, 3]);
  }

  return corners;
}

export function allSixLines(rules: RouletteRules): Pocket[][] {
  const lines: Pocket[][] = [];
  for (let row = 1; row < 12; row++) {
    const base = (row - 1) * 3 + 1;
    lines.push([base, base + 1, base + 2, base + 3, base + 4, base + 5]);
  }
  return lines;
}

export function basketPockets(rules: RouletteRules): Pocket[] {
  return isEuropeanLayout(rules) ? [0, 1, 2, 3] : [];
}

export function topLinePockets(rules: RouletteRules): Pocket[] {
  return isEuropeanLayout(rules) ? [] : [0, "00", 1, 2, 3];
}

export function pocketInList(pocket: Pocket, targets: Pocket[]): boolean {
  return targets.some((t) => t === pocket);
}

export function pocketInPair(pocket: Pocket, pair: [Pocket, Pocket]): boolean {
  return pair[0] === pocket || pair[1] === pocket;
}

export function pocketInStreet(pocket: Pocket, street: Pocket[]): boolean {
  return street.includes(pocket);
}

export function pocketInCorner(pocket: Pocket, corner: Pocket[]): boolean {
  return corner.includes(pocket);
}

export function pocketInSixLine(pocket: Pocket, line: Pocket[]): boolean {
  return line.includes(pocket);
}
