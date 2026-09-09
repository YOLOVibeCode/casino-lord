import type { Pocket } from "./types.js";
import type { RouletteBetTarget } from "./bet-target.js";
import {
  allCorners,
  allSixLines,
  allSplits,
  allStreets,
  allStraights,
  basketPockets,
  pocketInCorner,
  pocketInList,
  pocketInPair,
  pocketInSixLine,
  pocketInStreet,
  topLinePockets,
} from "./felt.js";
import { classifyPocket, wheelNeighbours } from "./wheel.js";
import type { RouletteRules } from "./rules.js";

export function pocketInTarget(
  pocket: Pocket,
  target: RouletteBetTarget,
  rules: RouletteRules,
): boolean {
  switch (target.kind) {
    case "straight":
      return target.pocket === pocket;
    case "split":
      return pocketInPair(pocket, target.pockets);
    case "street":
      return pocketInStreet(pocket, target.pockets);
    case "corner":
      return pocketInCorner(pocket, target.pockets);
    case "six_line":
      return pocketInSixLine(pocket, target.pockets);
    case "basket":
      return pocketInList(pocket, basketPockets(rules));
    case "top_line":
      return pocketInList(pocket, topLinePockets(rules));
    case "dozen": {
      if (pocket === 0 || pocket === "00" || typeof pocket !== "number") return false;
      return Math.ceil(pocket / 12) === target.n;
    }
    case "column": {
      if (pocket === 0 || pocket === "00" || typeof pocket !== "number") return false;
      return ((pocket - 1) % 3) + 1 === target.n;
    }
    case "red":
      return classifyPocket(pocket, rules).color === "red";
    case "black":
      return classifyPocket(pocket, rules).color === "black";
    case "odd":
      return classifyPocket(pocket, rules).parity === "odd";
    case "even":
      return classifyPocket(pocket, rules).parity === "even";
    case "low":
      return classifyPocket(pocket, rules).range === "low";
    case "high":
      return classifyPocket(pocket, rules).range === "high";
    case "voisins":
    case "tiers":
    case "orphelins":
    case "jeu_zero":
    case "neighbours":
      return false;
  }
}

export function allInsideTargets(rules: RouletteRules): RouletteBetTarget[] {
  const targets: RouletteBetTarget[] = [];
  for (const pocket of allStraights(rules)) {
    targets.push({ kind: "straight", pocket });
  }
  for (const pair of allSplits(rules)) {
    targets.push({ kind: "split", pockets: pair });
  }
  for (const street of allStreets(rules)) {
    targets.push({ kind: "street", pockets: street });
  }
  for (const corner of allCorners(rules)) {
    targets.push({ kind: "corner", pockets: corner });
  }
  for (const line of allSixLines(rules)) {
    targets.push({ kind: "six_line", pockets: line });
  }
  if (basketPockets(rules).length > 0) targets.push({ kind: "basket" });
  if (topLinePockets(rules).length > 0) targets.push({ kind: "top_line" });
  return targets;
}

export function neighbourTargets(pocket: Pocket, rules: RouletteRules): RouletteBetTarget[] {
  return wheelNeighbours(pocket, rules, 2).map((p) => ({ kind: "straight", pocket: p }));
}
