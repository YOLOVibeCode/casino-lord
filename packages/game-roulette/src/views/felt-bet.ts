import type { PlacedBet } from "@casino-lord/core";
import type { RouletteBetId, RouletteBetTarget } from "../bet-target.js";
import { allInsideTargets } from "../targets.js";
import { isEuropeanLayout, type RouletteRules } from "../rules.js";
import { payoutRatio } from "../payout-table.js";
import type { Pocket } from "../types.js";
import { wheelOrder } from "../wheel.js";
import { columnOf, rowOf } from "../felt.js";

export interface FeltZone {
  zoneId: string;
  type: RouletteBetId;
  target: RouletteBetTarget;
  label: string;
}

export interface BetPayloadContext {
  playerId: string;
  roundId: string;
  amount: number;
  declared: boolean;
  working?: boolean;
  originRoundId: string;
}

function pocketToken(p: Pocket): string {
  return p === "00" ? "00" : String(p);
}

function sortPockets(pockets: Pocket[]): Pocket[] {
  return [...pockets].sort((a, b) => {
    const key = (p: Pocket) => (p === "00" ? 37 : Number(p));
    return key(a) - key(b);
  });
}

export function zoneIdForTarget(type: RouletteBetId, target: RouletteBetTarget): string {
  switch (target.kind) {
    case "straight":
      return `straight:${pocketToken(target.pocket)}`;
    case "split":
      return `split:${sortPockets(target.pockets).map(pocketToken).join("-")}`;
    case "street":
      return `street:${sortPockets(target.pockets).map(pocketToken).join("-")}`;
    case "corner":
      return `corner:${sortPockets(target.pockets).map(pocketToken).join("-")}`;
    case "six_line":
      return `six_line:${sortPockets(target.pockets).map(pocketToken).join("-")}`;
    case "basket":
      return "basket";
    case "top_line":
      return "top_line";
    case "dozen":
      return `dozen:${target.n}`;
    case "column":
      return `column:${target.n}`;
    case "red":
    case "black":
    case "odd":
    case "even":
    case "low":
    case "high":
    case "voisins":
    case "tiers":
    case "orphelins":
    case "jeu_zero":
      return target.kind;
    case "neighbours":
      return `neighbours:${pocketToken(target.pocket)}`;
    default:
      return type;
  }
}

export function targetFromZoneId(zoneId: string, rules: RouletteRules): RouletteBetTarget | null {
  if (zoneId === "basket") return { kind: "basket" };
  if (zoneId === "top_line") return { kind: "top_line" };
  if (zoneId === "red") return { kind: "red" };
  if (zoneId === "black") return { kind: "black" };
  if (zoneId === "odd") return { kind: "odd" };
  if (zoneId === "even") return { kind: "even" };
  if (zoneId === "low") return { kind: "low" };
  if (zoneId === "high") return { kind: "high" };
  if (zoneId === "voisins") return { kind: "voisins" };
  if (zoneId === "tiers") return { kind: "tiers" };
  if (zoneId === "orphelins") return { kind: "orphelins" };
  if (zoneId === "jeu_zero") return { kind: "jeu_zero" };

  const straight = /^straight:(.+)$/.exec(zoneId);
  if (straight) {
    const p = parsePocketToken(straight[1]!);
    if (p !== null) return { kind: "straight", pocket: p };
  }

  const neighbours = /^neighbours:(.+)$/.exec(zoneId);
  if (neighbours) {
    const p = parsePocketToken(neighbours[1]!);
    if (p !== null) return { kind: "neighbours", pocket: p };
  }

  const dozen = /^dozen:([123])$/.exec(zoneId);
  if (dozen) return { kind: "dozen", n: Number(dozen[1]) as 1 | 2 | 3 };

  const column = /^column:([123])$/.exec(zoneId);
  if (column) return { kind: "column", n: Number(column[1]) as 1 | 2 | 3 };

  const multi = /^(split|street|corner|six_line):(.+)$/.exec(zoneId);
  if (multi) {
    const pockets = multi[2]!.split("-").map(parsePocketToken);
    if (pockets.some((p) => p === null)) return null;
    const ps = pockets as Pocket[];
    switch (multi[1]) {
      case "split":
        return { kind: "split", pockets: [ps[0]!, ps[1]!] };
      case "street":
        return { kind: "street", pockets: ps };
      case "corner":
        return { kind: "corner", pockets: ps };
      case "six_line":
        return { kind: "six_line", pockets: ps };
    }
  }

  return null;
}

function parsePocketToken(token: string): Pocket | null {
  if (token === "00") return "00";
  if (token === "0") return 0;
  const n = Number(token);
  if (Number.isInteger(n) && n >= 1 && n <= 36) return n;
  return null;
}

export function targetsEqual(a: RouletteBetTarget, b: RouletteBetTarget): boolean {
  return zoneIdForTarget(a.kind, a) === zoneIdForTarget(b.kind, b);
}

export function labelForTarget(type: RouletteBetId, target: RouletteBetTarget): string {
  switch (target.kind) {
    case "straight":
      return `Straight ${pocketToken(target.pocket)}`;
    case "split":
      return `Split ${target.pockets.map(pocketToken).join("/")}`;
    case "street":
      return `Street ${target.pockets.map(pocketToken).join("-")}`;
    case "corner":
      return `Corner ${target.pockets.map(pocketToken).join("-")}`;
    case "six_line":
      return `Six Line ${target.pockets.map(pocketToken).join("-")}`;
    case "basket":
      return "Basket 0-1-2-3";
    case "top_line":
      return "Top Line 0-00-1-2-3";
    case "dozen":
      return `${target.n}${target.n === 1 ? "st" : target.n === 2 ? "nd" : "rd"} 12`;
    case "column":
      return `Column ${target.n} (2:1)`;
    case "red":
      return "Red";
    case "black":
      return "Black";
    case "odd":
      return "Odd";
    case "even":
      return "Even";
    case "low":
      return "1–18";
    case "high":
      return "19–36";
    case "voisins":
      return "Voisins du Zéro";
    case "tiers":
      return "Tiers du Cylindre";
    case "orphelins":
      return "Orphelins";
    case "jeu_zero":
      return "Jeu Zéro";
    case "neighbours":
      return `Neighbours ${pocketToken(target.pocket)}`;
    default:
      return type;
  }
}

export function formatZonePayout(type: RouletteBetId, rules: RouletteRules): string {
  const ratio = payoutRatio(type, rules);
  if (ratio === "itemised") return "itemised";
  const base = `${ratio.num}:${ratio.den}`;
  const evenMoney = new Set(["red", "black", "odd", "even", "low", "high"]);
  if (evenMoney.has(type) && rules.wheel === "french" && rules.zeroRule !== "none") {
    const note = rules.zeroRule === "la_partage" ? "La partage on 0" : "En prison on 0";
    return `${base} · ${note}`;
  }
  return base;
}

export function isZoneAllowed(zoneId: string, rules: RouletteRules): true | string {
  const target = targetFromZoneId(zoneId, rules);
  if (!target) return "Unknown bet";

  if (target.kind === "basket" && !isEuropeanLayout(rules)) {
    return "Basket is EU/FR only";
  }
  if (target.kind === "top_line" && isEuropeanLayout(rules)) {
    return "Top line is American only";
  }
  if (
    (target.kind === "voisins" ||
      target.kind === "tiers" ||
      target.kind === "orphelins" ||
      target.kind === "jeu_zero" ||
      target.kind === "neighbours") &&
    (rules.wheel === "american" || !rules.allowCallBets)
  ) {
    return "Call bets not available";
  }

  return true;
}

export function betPayloadFromZone(
  zoneId: string,
  ctx: BetPayloadContext,
  rules: RouletteRules,
): Omit<PlacedBet<RouletteBetTarget>, "id" | "placedAt"> | null {
  const allowed = isZoneAllowed(zoneId, rules);
  if (allowed !== true) return null;

  const target = targetFromZoneId(zoneId, rules);
  if (!target) return null;

  const type = target.kind as RouletteBetId;
  return {
    playerId: ctx.playerId,
    roundId: ctx.roundId,
    type,
    target,
    amount: ctx.amount,
    declared: ctx.declared,
    working: ctx.working ?? false,
    originRoundId: ctx.originRoundId,
  };
}

export function enumerateFeltZones(rules: RouletteRules): FeltZone[] {
  const zones: FeltZone[] = [];

  for (const target of allInsideTargets(rules)) {
    const type = target.kind as RouletteBetId;
    zones.push({
      zoneId: zoneIdForTarget(type, target),
      type,
      target,
      label: labelForTarget(type, target),
    });
  }

  for (const n of [1, 2, 3] as const) {
    const dozenTarget: RouletteBetTarget = { kind: "dozen", n };
    zones.push({
      zoneId: zoneIdForTarget("dozen", dozenTarget),
      type: "dozen",
      target: dozenTarget,
      label: labelForTarget("dozen", dozenTarget),
    });
    const columnTarget: RouletteBetTarget = { kind: "column", n };
    zones.push({
      zoneId: zoneIdForTarget("column", columnTarget),
      type: "column",
      target: columnTarget,
      label: labelForTarget("column", columnTarget),
    });
  }

  for (const kind of ["red", "black", "odd", "even", "low", "high"] as const) {
    const target: RouletteBetTarget = { kind };
    zones.push({
      zoneId: kind,
      type: kind,
      target,
      label: labelForTarget(kind, target),
    });
  }

  if (isEuropeanLayout(rules) && rules.allowCallBets) {
    for (const kind of ["voisins", "tiers", "orphelins", "jeu_zero"] as const) {
      const target: RouletteBetTarget = { kind };
      zones.push({
        zoneId: kind,
        type: kind,
        target,
        label: labelForTarget(kind, target),
      });
    }
    for (const pocket of wheelOrder(rules)) {
      const target: RouletteBetTarget = { kind: "neighbours", pocket };
      zones.push({
        zoneId: zoneIdForTarget("neighbours", target),
        type: "neighbours",
        target,
        label: labelForTarget("neighbours", target),
      });
    }
  }

  return zones;
}

/** Display row 1–3 (top to bottom: col3, col2, col1) and column 1–12 for felt layout. */
export function pocketDisplayPos(pocket: Pocket): { row: number; col: number } | null {
  if (pocket === 0 || pocket === "00") return null;
  if (typeof pocket !== "number") return null;
  return { row: 4 - columnOf(pocket), col: rowOf(pocket) };
}

export function buildNumberRows(): number[][] {
  const rows: number[][] = [];
  for (let r = 0; r < 12; r++) {
    const base = r * 3 + 1;
    rows.push([base, base + 1, base + 2]);
  }
  return rows.reverse();
}

/** Three horizontal lines per SPEC-ROULETTE §13.2 portrait layout (col3, col2, col1). */
export function portraitNumberLines(): number[][] {
  const lines: number[][] = [[], [], []];
  for (let n = 1; n <= 36; n++) {
    const lineIndex = 3 - columnOf(n);
    lines[lineIndex]!.push(n);
  }
  return lines;
}

export function numberGridPosition(pocket: number): { gridRow: number; gridCol: number } {
  return { gridRow: 4 - columnOf(pocket), gridCol: rowOf(pocket) + 1 };
}

export function dozenForCol(col: number): 1 | 2 | 3 {
  if (col <= 4) return 1;
  if (col <= 8) return 2;
  return 3;
}

const GRID_W = 14;
const GRID_H = 3;

function cellCenterFraction(pocket: Pocket): { x: number; y: number } {
  if (pocket === 0) return { x: 0.5 / GRID_W, y: 0.5 / GRID_H };
  if (pocket === "00") return { x: 0.5 / GRID_W, y: (2.5 / GRID_H) * (1 / 3) + 2 / GRID_H };
  const pos = pocketDisplayPos(pocket);
  if (!pos) return { x: 0.5 / GRID_W, y: 0.5 / GRID_H };
  return { x: (1 + pos.col - 0.5) / GRID_W, y: (pos.row - 0.5) / GRID_H };
}

export interface HitZoneStyle {
  left: string;
  top: string;
  width: string;
  height: string;
}

export function hitZoneStyle(target: RouletteBetTarget, _rules: RouletteRules): HitZoneStyle {
  const base = { width: "14%", height: "28%" };

  switch (target.kind) {
    case "straight": {
      const c = cellCenterFraction(target.pocket);
      return {
        ...base,
        left: `${c.x * 100}%`,
        top: `${c.y * 100}%`,
      };
    }
    case "split": {
      const [a, b] = target.pockets;
      const ca = cellCenterFraction(a);
      const cb = cellCenterFraction(b);
      return {
        width: "10%",
        height: "10%",
        left: `${((ca.x + cb.x) / 2) * 100}%`,
        top: `${((ca.y + cb.y) / 2) * 100}%`,
      };
    }
    case "street": {
      const sorted = sortPockets(target.pockets);
      const mid = sorted[Math.floor(sorted.length / 2)]!;
      const c = cellCenterFraction(mid);
      return {
        width: "8%",
        height: "12%",
        left: `${c.x * 100}%`,
        top: `${c.y * 100}%`,
      };
    }
    case "corner":
    case "six_line": {
      const pockets = target.pockets;
      const cx = pockets.reduce((s: number, p) => s + cellCenterFraction(p).x, 0) / pockets.length;
      const cy = pockets.reduce((s: number, p) => s + cellCenterFraction(p).y, 0) / pockets.length;
      return {
        width: "10%",
        height: "10%",
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
      };
    }
    case "basket":
    case "top_line": {
      return {
        width: "12%",
        height: "12%",
        left: `${(0.5 / GRID_W) * 100}%`,
        top: `${(0.5 / GRID_H) * 100}%`,
      };
    }
    default:
      return { width: "10%", height: "10%", left: "50%", top: "50%" };
  }
}

export function insideHitZones(rules: RouletteRules): FeltZone[] {
  return enumerateFeltZones(rules).filter((z) =>
    ["straight", "split", "street", "corner", "six_line", "basket", "top_line"].includes(z.type),
  );
}
