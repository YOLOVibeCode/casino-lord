import type {
  Color,
  NumberInfo,
  Pocket,
  RoulettePercentages,
  SpinRecord,
  StreakValue,
} from "./types.js";
import { classifyPocket, pocketKey, wheelOrder } from "./wheel.js";
import type { RouletteRules } from "./rules.js";
import type { RouletteResult } from "./types.js";

export interface SpinEntry {
  id: string;
  data: RouletteResult;
}

export interface RouletteState {
  spins: SpinEntry[];
  livePending: Pocket | null;
  history: SpinRecord[];
  counts: Record<string, number>;
  streaks: {
    color: StreakValue<Color> | null;
    parity: StreakValue<"odd" | "even"> | null;
    range: StreakValue<"low" | "high"> | null;
  };
  repeats: number;
  zeroDrought: number;
  hot: Pocket[];
  cold: Pocket[];
  percentages: RoulettePercentages;
  lastSpin: SpinRecord | null;
  longestColorStreak: StreakValue<Color> | null;
  sectorCounts: Record<string, number>;
}

function isZero(pocket: Pocket | null): boolean {
  return pocket === 0 || pocket === "00";
}

function spinToRecord(data: RouletteResult, rules: RouletteRules): SpinRecord {
  if (data.pocket === null) return { pocket: null, info: null };
  return { pocket: data.pocket, info: classifyPocket(data.pocket, rules) };
}

function countedSpins(spins: SpinEntry[], rules: RouletteRules): SpinRecord[] {
  const records = spins.map((s) => spinToRecord(s.data, rules)).filter((r) => r.pocket !== null);
  if (rules.statsWindow === "session") return records;
  return records.slice(-rules.statsWindow);
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function computeStreak<T>(values: (T | null)[]): StreakValue<T> | null {
  if (values.length === 0) return null;
  const last = values[values.length - 1] ?? null;
  if (last === null) return null;
  let length = 1;
  for (let i = values.length - 2; i >= 0; i--) {
    if ((values[i] ?? null) !== last) break;
    length++;
  }
  return { value: last, length };
}

function longestStreak<T>(values: (T | null)[]): StreakValue<T> | null {
  let best: StreakValue<T> | null = null;
  let i = 0;
  while (i < values.length) {
    const v = values[i] ?? null;
    if (v === null) {
      i++;
      continue;
    }
    let length = 1;
    let j = i + 1;
    while (j < values.length && (values[j] ?? null) === v) {
      length++;
      j++;
    }
    if (!best || length > best.length) best = { value: v, length };
    i = j;
  }
  return best;
}

export function rebuildDerived(
  spins: SpinEntry[],
  livePending: Pocket | null,
  rules: RouletteRules,
): Omit<RouletteState, "spins" | "livePending"> {
  const history = spins.map((s) => spinToRecord(s.data, rules));
  const window = countedSpins(spins, rules);

  const counts: Record<string, number> = {};
  for (const p of wheelOrder(rules)) {
    counts[pocketKey(p)] = 0;
  }
  for (const r of window) {
    if (r.pocket !== null) counts[pocketKey(r.pocket)]!++;
  }

  const colorValues = window.map((r) => r.info?.color ?? null);
  const parityValues = window.map((r) => r.info?.parity ?? null);
  const rangeValues = window.map((r) => r.info?.range ?? null);

  let repeats = 0;
  if (window.length >= 2) {
    const lastPocket = window[window.length - 1]!.pocket;
    if (lastPocket !== null) {
      for (let i = window.length - 2; i >= 0; i--) {
        if (window[i]!.pocket === lastPocket) repeats++;
        else break;
      }
    }
  }

  let zeroDrought = 0;
  for (let i = window.length - 1; i >= 0; i--) {
    const p = window[i]!.pocket;
    if (p !== null && isZero(p)) break;
    zeroDrought++;
  }

  const ranked = wheelOrder(rules)
    .map((p) => ({
      pocket: p,
      count: counts[pocketKey(p)] ?? 0,
      wheelIndex: wheelOrder(rules).indexOf(p),
    }))
    .sort((a, b) => b.count - a.count || a.wheelIndex - b.wheelIndex);

  const hot = ranked.slice(0, 5).map((r) => r.pocket);
  const cold = [...ranked]
    .reverse()
    .slice(0, 5)
    .map((r) => r.pocket);

  let red = 0;
  let black = 0;
  let green = 0;
  let odd = 0;
  let even = 0;
  let low = 0;
  let high = 0;
  const dozen = [0, 0, 0] as [number, number, number];
  const column = [0, 0, 0] as [number, number, number];

  for (const r of window) {
    const info = r.info;
    if (!info) continue;
    if (info.color === "red") red++;
    else if (info.color === "black") black++;
    else green++;
    if (info.parity === "odd") odd++;
    else if (info.parity === "even") even++;
    if (info.range === "low") low++;
    else if (info.range === "high") high++;
    if (info.dozen !== null) dozen[info.dozen - 1]!++;
    if (info.column !== null) column[info.column - 1]!++;
  }

  const total = window.length;
  const propDenom = rules.zeroInDenominator ? total : total - green;
  const percentages: RoulettePercentages = {
    red: pct(red, total),
    black: pct(black, total),
    green: pct(green, total),
    odd: pct(odd, propDenom),
    even: pct(even, propDenom),
    low: pct(low, propDenom),
    high: pct(high, propDenom),
    dozen: [pct(dozen[0]!, propDenom), pct(dozen[1]!, propDenom), pct(dozen[2]!, propDenom)],
    column: [pct(column[0]!, propDenom), pct(column[1]!, propDenom), pct(column[2]!, propDenom)],
  };

  const sectorCounts: Record<string, number> = {};
  if (rules.showSectors) {
    for (const r of window) {
      const s = r.info?.sector;
      if (s) sectorCounts[s] = (sectorCounts[s] ?? 0) + 1;
    }
  }

  return {
    history,
    counts,
    streaks: {
      color: computeStreak(colorValues),
      parity: computeStreak(parityValues),
      range: computeStreak(rangeValues),
    },
    repeats,
    zeroDrought,
    hot,
    cold,
    percentages,
    lastSpin: history.length > 0 ? history[history.length - 1]! : null,
    longestColorStreak: longestStreak(colorValues),
    sectorCounts,
  };
}

export function initialState(rules: RouletteRules): RouletteState {
  return {
    spins: [],
    livePending: null,
    ...rebuildDerived([], null, rules),
  };
}
