import type { PlacedBet, Settlement } from "@casino-lord/core";
import type { ImprisonedMarker, RouletteBetId, RouletteBetTarget } from "./bet-target.js";
import { callComponents, totalCallUnits } from "./call-bets.js";
import { payoutRatio } from "./payout-table.js";
import type { RouletteRules } from "./rules.js";
import type { RouletteState } from "./state.js";
import { pocketInTarget } from "./targets.js";
import type { Pocket, RouletteResult } from "./types.js";
import { wheelNeighbours } from "./wheel.js";

export interface SettleInput {
  bets: PlacedBet<RouletteBetTarget>[];
  result: RouletteResult;
  before: RouletteState;
  after: RouletteState;
  rules: RouletteRules;
}

const EVEN_MONEY: RouletteBetId[] = ["red", "black", "odd", "even", "low", "high"];

function isZero(pocket: Pocket | null): boolean {
  return pocket === 0 || pocket === "00";
}

function isImprisoned(bet: PlacedBet<RouletteBetTarget>): boolean {
  const target = bet.target as (RouletteBetTarget & ImprisonedMarker) | undefined;
  return target !== undefined && "imprisoned" in target && target.imprisoned === true;
}

function win(
  betId: string,
  stake: number,
  num: number,
  den: number,
): Settlement<RouletteBetTarget> {
  const profit = Math.floor((stake * num) / den);
  return { betId, outcome: "win", returned: stake + profit, profit };
}

function lose(betId: string, stake: number): Settlement<RouletteBetTarget> {
  return { betId, outcome: "lose", returned: 0, profit: -stake };
}

function push(betId: string, stake: number): Settlement<RouletteBetTarget> {
  return { betId, outcome: "push", returned: stake, profit: 0 };
}

function resolveTarget(bet: PlacedBet<RouletteBetTarget>): RouletteBetTarget {
  if (bet.target) return bet.target;
  return { kind: bet.type as RouletteBetId } as RouletteBetTarget;
}

function settleEvenMoney(
  bet: PlacedBet<RouletteBetTarget>,
  pocket: Pocket | null,
  rules: RouletteRules,
): Settlement<RouletteBetTarget> {
  const { id: betId, amount } = bet;
  const target = resolveTarget(bet);
  if (pocket === null) return lose(betId, amount);

  if (isImprisoned(bet)) {
    if (pocketInTarget(pocket, target, rules)) return push(betId, amount);
    return lose(betId, amount);
  }

  if (pocketInTarget(pocket, target, rules)) return win(betId, amount, 1, 1);

  if (isZero(pocket) && rules.zeroRule === "la_partage") {
    const half = Math.floor(amount / 2);
    return {
      betId,
      outcome: "partial",
      returned: half,
      profit: half - amount,
      note: "la partage: half returned",
    };
  }

  if (isZero(pocket) && rules.zeroRule === "en_prison") {
    const carryTarget = {
      ...target,
      imprisoned: true,
    } as RouletteBetTarget & ImprisonedMarker;
    return {
      betId,
      outcome: "stay",
      returned: 0,
      profit: 0,
      note: "en prison",
      carry: { ...bet, working: true, target: carryTarget },
    };
  }

  return lose(betId, amount);
}

function settleComponent(
  betId: string,
  unitStake: number,
  target: RouletteBetTarget,
  pocket: Pocket | null,
  rules: RouletteRules,
): Settlement<RouletteBetTarget> {
  if (pocket === null) return lose(betId, unitStake);
  if (pocketInTarget(pocket, target, rules)) {
    const ratio = payoutRatio(
      target.kind === "straight"
        ? "straight"
        : target.kind === "split"
          ? "split"
          : target.kind === "street"
            ? "street"
            : target.kind === "corner"
              ? "corner"
              : "straight",
      rules,
    );
    if (ratio === "itemised") return lose(betId, unitStake);
    return win(betId, unitStake, ratio.num, ratio.den);
  }
  return lose(betId, unitStake);
}

function settleCallBet(
  bet: PlacedBet<RouletteBetTarget>,
  pocket: Pocket | null,
  rules: RouletteRules,
): Settlement<RouletteBetTarget> {
  const target = bet.target;
  if (!target) return lose(bet.id, bet.amount);

  const kind = target.kind;
  const anchor = target.kind === "neighbours" ? target.pocket : undefined;

  const components =
    kind === "neighbours" && anchor !== undefined
      ? wheelNeighbours(anchor, rules, 2).map((p) => ({
          label: `straight ${String(p)}`,
          target: { kind: "straight" as const, pocket: p },
          units: 1,
        }))
      : callComponents(kind);

  const totalUnits = kind === "neighbours" ? 5 : totalCallUnits(kind);
  const unitStake = Math.floor(bet.amount / totalUnits);
  const notes: string[] = [];
  let totalReturned = 0;
  let totalProfit = 0;
  let anyWin = false;

  for (const comp of components) {
    const compStake = unitStake * comp.units;
    const compResult = settleComponent(
      `${bet.id}:${comp.label}`,
      compStake,
      comp.target,
      pocket,
      rules,
    );
    if (compResult.outcome === "win") {
      anyWin = true;
      notes.push(`${comp.label}: +${compResult.profit}`);
    }
    totalReturned += compResult.returned;
    totalProfit += compResult.profit;
  }

  return {
    betId: bet.id,
    outcome: anyWin ? "win" : "lose",
    returned: totalReturned,
    profit: totalProfit,
    ...(notes.length > 0 ? { note: notes.join("; ") } : {}),
  };
}

function settleStandardBet(
  bet: PlacedBet<RouletteBetTarget>,
  pocket: Pocket | null,
  rules: RouletteRules,
): Settlement<RouletteBetTarget> {
  const { id: betId, amount, type, target } = bet;

  if (EVEN_MONEY.includes(type as RouletteBetId)) {
    return settleEvenMoney(bet, pocket, rules);
  }

  if (
    type === "voisins" ||
    type === "tiers" ||
    type === "orphelins" ||
    type === "jeu_zero" ||
    type === "neighbours"
  ) {
    return settleCallBet(bet, pocket, rules);
  }

  if (pocket === null || !target) return lose(betId, amount);
  if (pocketInTarget(pocket, target, rules)) {
    const ratio = payoutRatio(type, rules);
    if (ratio === "itemised") return lose(betId, amount);
    return win(betId, amount, ratio.num, ratio.den);
  }
  return lose(betId, amount);
}

export function settleRoulette(input: SettleInput): Settlement<RouletteBetTarget>[] {
  const pocket = input.result.pocket;
  return input.bets.map((bet) => {
    if (isImprisoned(bet) && isZero(pocket) && input.rules.zeroRule === "en_prison") {
      if (input.rules.doublePrison) {
        return {
          betId: bet.id,
          outcome: "stay",
          returned: 0,
          profit: 0,
          note: "en prison (double zero)",
          carry: bet,
        };
      }
      return lose(bet.id, bet.amount);
    }
    return settleStandardBet(bet, pocket, input.rules);
  });
}
