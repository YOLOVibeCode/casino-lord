import type { PlacedBet, Settlement } from "@casino-lord/core";
import { isCrapsTotal, isNatural, trueOddsDenominator, trueOddsNumerator } from "./engine.js";
import type { CrapsBetTarget } from "./bet-target.js";
import type { CrapsRules } from "./rules.js";
import type { CrapsResult, CrapsState, Point } from "./types.js";

export interface SettleInput {
  bets: PlacedBet<CrapsBetTarget>[];
  result: CrapsResult;
  before: CrapsState;
  after: CrapsState;
  rules: CrapsRules;
}

function win(betId: string, stake: number, profit: number): Settlement<CrapsBetTarget> {
  return { betId, outcome: "win", returned: stake + profit, profit };
}

function lose(betId: string, stake: number): Settlement<CrapsBetTarget> {
  return { betId, outcome: "lose", returned: 0, profit: -stake };
}

function push(betId: string, stake: number): Settlement<CrapsBetTarget> {
  return { betId, outcome: "push", returned: stake, profit: 0 };
}

function stay(
  bet: PlacedBet<CrapsBetTarget>,
  carry?: PlacedBet<CrapsBetTarget>,
): Settlement<CrapsBetTarget> {
  return {
    betId: bet.id,
    outcome: "stay",
    returned: 0,
    profit: 0,
    carry: carry ?? bet,
  };
}

function travelTarget(total: number): CrapsBetTarget | undefined {
  if (total === 4 || total === 5 || total === 6 || total === 8 || total === 9 || total === 10) {
    return { kind: "point", value: total };
  }
  return undefined;
}

function isComeOutRoll(before: CrapsState): boolean {
  return before.lastRoll?.info.phase === "come_out";
}

function placeOffOnComeOut(
  bet: PlacedBet<CrapsBetTarget>,
  before: CrapsState,
  rules: CrapsRules,
): boolean {
  if (before.phase !== "come_out") return false;
  const defaultWorking = rules.placeWorkingOnComeOut;
  return !bet.working && !defaultWorking;
}

function oddsOffOnComeOut(
  bet: PlacedBet<CrapsBetTarget>,
  before: CrapsState,
  betType: "pass_odds" | "dont_odds",
): boolean {
  if (before.phase !== "come_out") return false;
  if (bet.working) return false;
  const attach = bet.target?.kind === "attach" ? bet.target.line : undefined;
  if (betType === "pass_odds" && attach === "come") return true;
  if (betType === "dont_odds" && attach === "dont_come") return true;
  return false;
}

function buyVig(amount: number, rules: CrapsRules): number {
  if (rules.buyVigOnWin) return 0;
  return Math.max(1, Math.floor(amount * 0.05));
}

function settleLinePass(
  bet: PlacedBet<CrapsBetTarget>,
  result: CrapsResult,
  before: CrapsState,
  after: CrapsState,
): Settlement<CrapsBetTarget> {
  const { total } = result;
  const onComeOut = before.phase === "come_out";

  if (onComeOut) {
    if (isNatural(total)) return win(bet.id, bet.amount, bet.amount);
    if (isCrapsTotal(total)) return lose(bet.id, bet.amount);
    return stay(bet);
  }

  if (after.lastRoll?.info.decision === "point_made") return win(bet.id, bet.amount, bet.amount);
  if (after.lastRoll?.info.decision === "seven_out") return lose(bet.id, bet.amount);
  return stay(bet);
}

function settleLineDontPass(
  bet: PlacedBet<CrapsBetTarget>,
  result: CrapsResult,
  before: CrapsState,
  after: CrapsState,
  rules: CrapsRules,
): Settlement<CrapsBetTarget> {
  const { total } = result;
  const onComeOut = before.phase === "come_out";

  if (onComeOut) {
    if (isNatural(total)) return lose(bet.id, bet.amount);
    if (total === rules.barNumber) return push(bet.id, bet.amount);
    if (isCrapsTotal(total)) return win(bet.id, bet.amount, bet.amount);
    return stay(bet);
  }

  if (after.lastRoll?.info.decision === "point_made") return lose(bet.id, bet.amount);
  if (after.lastRoll?.info.decision === "seven_out") return win(bet.id, bet.amount, bet.amount);
  return stay(bet);
}

function settleCome(
  bet: PlacedBet<CrapsBetTarget>,
  result: CrapsResult,
  before: CrapsState,
  after: CrapsState,
): Settlement<CrapsBetTarget> {
  const { total } = result;
  const travelled = bet.target?.kind === "point" ? bet.target.value : undefined;

  if (!travelled) {
    if (isNatural(total)) return win(bet.id, bet.amount, bet.amount);
    if (isCrapsTotal(total)) return lose(bet.id, bet.amount);
    const target = travelTarget(total);
    if (!target) return stay(bet);
    return stay(bet, { ...bet, target });
  }

  if (total === 7) return lose(bet.id, bet.amount);
  if (total === travelled) return win(bet.id, bet.amount, bet.amount);
  return stay(bet);
}

function settleDontCome(
  bet: PlacedBet<CrapsBetTarget>,
  result: CrapsResult,
  before: CrapsState,
  after: CrapsState,
  rules: CrapsRules,
): Settlement<CrapsBetTarget> {
  const { total } = result;
  const travelled = bet.target?.kind === "point" ? bet.target.value : undefined;

  if (!travelled) {
    if (isNatural(total)) return lose(bet.id, bet.amount);
    if (total === rules.barNumber) return push(bet.id, bet.amount);
    if (isCrapsTotal(total)) return win(bet.id, bet.amount, bet.amount);
    const target = travelTarget(total);
    if (!target) return stay(bet);
    return stay(bet, { ...bet, target });
  }

  if (total === 7) return win(bet.id, bet.amount, bet.amount);
  if (total === travelled) return lose(bet.id, bet.amount);
  return stay(bet);
}

function settleOdds(
  bet: PlacedBet<CrapsBetTarget>,
  before: CrapsState,
  after: CrapsState,
  passSide: boolean,
): Settlement<CrapsBetTarget> {
  if (oddsOffOnComeOut(bet, before, passSide ? "pass_odds" : "dont_odds")) {
    return stay(bet);
  }

  const point = before.point;
  if (!point) return stay(bet);

  const decision = after.lastRoll?.info.decision;
  if (decision === "point_made") {
    if (passSide) {
      const profit = Math.floor(
        (bet.amount * trueOddsNumerator(point)) / trueOddsDenominator(point),
      );
      return win(bet.id, bet.amount, profit);
    }
    return lose(bet.id, bet.amount);
  }
  if (decision === "seven_out") {
    if (passSide) return lose(bet.id, bet.amount);
    const profit = Math.floor((bet.amount * trueOddsDenominator(point)) / trueOddsNumerator(point));
    return win(bet.id, bet.amount, profit);
  }
  return stay(bet);
}

function settlePlaceLike(
  bet: PlacedBet<CrapsBetTarget>,
  result: CrapsResult,
  before: CrapsState,
  after: CrapsState,
  rules: CrapsRules,
  mode: "place" | "buy" | "lay",
): Settlement<CrapsBetTarget> {
  if (placeOffOnComeOut(bet, before, rules) && before.phase === "come_out") {
    return stay(bet);
  }

  const point = bet.target?.kind === "point" ? bet.target.value : undefined;
  if (!point) return stay(bet);

  const { total } = result;
  if (mode === "lay") {
    if (total === 7) {
      const profit = Math.floor(
        (bet.amount * trueOddsDenominator(point)) / trueOddsNumerator(point),
      );
      const vig = rules.buyVigOnWin ? Math.max(1, Math.floor(profit * 0.05)) : 0;
      return win(bet.id, bet.amount, profit - vig);
    }
    if (total === point) return lose(bet.id, bet.amount);
    return stay(bet);
  }

  if (total === 7) return lose(bet.id, bet.amount);
  if (total === point) {
    let profit: number;
    if (mode === "place") {
      const odds = point === 4 || point === 10 ? 9 / 5 : point === 5 || point === 9 ? 7 / 5 : 7 / 6;
      profit = Math.floor(bet.amount * odds);
    } else {
      profit = Math.floor((bet.amount * trueOddsNumerator(point)) / trueOddsDenominator(point));
      if (!rules.buyVigOnWin) {
        return win(bet.id, bet.amount - buyVig(bet.amount, rules), profit);
      }
    }
    return win(bet.id, bet.amount, profit);
  }
  return stay(bet);
}

function settleHard(
  bet: PlacedBet<CrapsBetTarget>,
  result: CrapsResult,
  before: CrapsState,
  rules: CrapsRules,
): Settlement<CrapsBetTarget> {
  if (placeOffOnComeOut(bet, before, rules) && before.phase === "come_out") {
    return stay(bet);
  }

  const point = bet.target?.kind === "point" ? bet.target.value : undefined;
  if (!point) return stay(bet);

  const { total, hard } = result;
  if (total === 7) return lose(bet.id, bet.amount);
  if (total === point && hard === true) {
    const mult = point === 4 || point === 10 ? 7 : 9;
    return win(bet.id, bet.amount, bet.amount * mult);
  }
  if (total === point && hard === false) return lose(bet.id, bet.amount);
  return stay(bet);
}

function settleField(
  bet: PlacedBet<CrapsBetTarget>,
  result: CrapsResult,
  rules: CrapsRules,
): Settlement<CrapsBetTarget> {
  const { total } = result;
  const fieldNums = [2, 3, 4, 9, 10, 11, 12];
  if (!fieldNums.includes(total)) return lose(bet.id, bet.amount);
  if (total === 2) return win(bet.id, bet.amount, bet.amount * rules.field2);
  if (total === 12) return win(bet.id, bet.amount, bet.amount * rules.field12);
  return win(bet.id, bet.amount, bet.amount);
}

function settleFire(
  bet: PlacedBet<CrapsBetTarget>,
  after: CrapsState,
  rules: CrapsRules,
): Settlement<CrapsBetTarget> {
  const distinct = after.shooter.distinctPointsMade.length;
  if (after.lastRoll?.info.decision === "seven_out") {
    if (distinct >= 6) return win(bet.id, bet.amount, bet.amount * rules.fire6);
    if (distinct >= 5) return win(bet.id, bet.amount, bet.amount * rules.fire5);
    if (distinct >= 4) return win(bet.id, bet.amount, bet.amount * rules.fire4);
    return lose(bet.id, bet.amount);
  }
  if (distinct >= 6) return win(bet.id, bet.amount, bet.amount * rules.fire6);
  return stay(bet);
}

function settleAts(
  bet: PlacedBet<CrapsBetTarget>,
  result: CrapsResult,
  after: CrapsState,
  kind: "ats_small" | "ats_tall" | "ats_all",
): Settlement<CrapsBetTarget> {
  const { total } = result;
  if (total === 7 && after.lastRoll?.info.decision === "seven_out") {
    return lose(bet.id, bet.amount);
  }

  const smallComplete = [2, 3, 4, 5, 6].every((n) => after.shooter.ats.small.includes(n));
  const tallComplete = [8, 9, 10, 11, 12].every((n) => after.shooter.ats.tall.includes(n));

  if (kind === "ats_small" && smallComplete) return win(bet.id, bet.amount, bet.amount * 34);
  if (kind === "ats_tall" && tallComplete) return win(bet.id, bet.amount, bet.amount * 34);
  if (kind === "ats_all" && smallComplete && tallComplete) {
    return win(bet.id, bet.amount, bet.amount * 175);
  }
  return stay(bet);
}

function settleHornLike(
  bet: PlacedBet<CrapsBetTarget>,
  result: CrapsResult,
): Settlement<CrapsBetTarget> {
  const { total } = result;
  const unit = bet.amount / (bet.type === "ce" ? 2 : 4);
  let profit = -bet.amount;

  const pay = (t: number, mult: number) => {
    if (total === t) profit += unit * (mult + 1);
  };

  if (bet.type === "ce") {
    pay(2, 30);
    pay(3, 7);
    pay(11, 7);
    pay(12, 30);
  } else if (bet.type === "horn") {
    pay(2, 30);
    pay(3, 15);
    pay(11, 15);
    pay(12, 30);
  } else if (bet.type.startsWith("horn_high_")) {
    const high = Number(bet.type.replace("horn_high_", ""));
    pay(2, 30);
    pay(3, 15);
    pay(11, 15);
    pay(12, 30);
    if (total === high) profit += unit * 2;
  }

  if (profit > -bet.amount) {
    return win(bet.id, bet.amount, profit + bet.amount);
  }
  return lose(bet.id, bet.amount);
}

export function settleCraps(input: SettleInput): Settlement<CrapsBetTarget>[] {
  const { bets, result, before, after, rules } = input;
  return bets.map((bet) => {
    switch (bet.type) {
      case "pass":
        return settleLinePass(bet, result, before, after);
      case "dont_pass":
        return settleLineDontPass(bet, result, before, after, rules);
      case "come":
        return settleCome(bet, result, before, after);
      case "dont_come":
        return settleDontCome(bet, result, before, after, rules);
      case "pass_odds":
        return settleOdds(bet, before, after, true);
      case "dont_odds":
        return settleOdds(bet, before, after, false);
      case "place":
        return settlePlaceLike(bet, result, before, after, rules, "place");
      case "buy":
        return settlePlaceLike(bet, result, before, after, rules, "buy");
      case "lay":
        return settlePlaceLike(bet, result, before, after, rules, "lay");
      case "hard":
        return settleHard(bet, result, before, rules);
      case "field":
        return settleField(bet, result, rules);
      case "any_seven":
        return result.total === 7
          ? win(bet.id, bet.amount, bet.amount * 4)
          : lose(bet.id, bet.amount);
      case "any_craps":
        return isCrapsTotal(result.total)
          ? win(bet.id, bet.amount, bet.amount * 7)
          : lose(bet.id, bet.amount);
      case "two":
        return result.total === 2
          ? win(bet.id, bet.amount, bet.amount * 30)
          : lose(bet.id, bet.amount);
      case "twelve":
        return result.total === 12
          ? win(bet.id, bet.amount, bet.amount * 30)
          : lose(bet.id, bet.amount);
      case "three":
        return result.total === 3
          ? win(bet.id, bet.amount, bet.amount * 15)
          : lose(bet.id, bet.amount);
      case "eleven":
        return result.total === 11
          ? win(bet.id, bet.amount, bet.amount * 15)
          : lose(bet.id, bet.amount);
      case "horn":
      case "horn_high_2":
      case "horn_high_3":
      case "horn_high_11":
      case "horn_high_12":
      case "ce":
        return settleHornLike(bet, result);
      case "fire":
        return settleFire(bet, after, rules);
      case "ats_small":
        return settleAts(bet, result, after, "ats_small");
      case "ats_tall":
        return settleAts(bet, result, after, "ats_tall");
      case "ats_all":
        return settleAts(bet, result, after, "ats_all");
      default:
        return lose(bet.id, bet.amount);
    }
  });
}
