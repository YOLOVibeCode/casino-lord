import type { PlacedBet, Settlement } from "@casino-lord/core";
import type { BlackjackBetId, BlackjackBetTarget } from "./bet-target.js";
import { blackjackPayoutFraction, evaluate21Plus3, evaluatePerfectPairs } from "./engine.js";
import type { BlackjackRules } from "./rules.js";
import type { BlackjackResult, HandInput, SeatOutcome } from "./types.js";
import type { BlackjackState } from "./state.js";

export interface SettleInput {
  bets: PlacedBet<BlackjackBetTarget>[];
  result: BlackjackResult;
  before: BlackjackState;
  after: BlackjackState;
  rules: BlackjackRules;
}

function win(betId: string, stake: number, profit: number): Settlement<BlackjackBetTarget> {
  return { betId, outcome: "win", returned: stake + profit, profit };
}

function lose(betId: string, stake: number): Settlement<BlackjackBetTarget> {
  return { betId, outcome: "lose", returned: 0, profit: -stake };
}

function push(betId: string, stake: number): Settlement<BlackjackBetTarget> {
  return { betId, outcome: "push", returned: stake, profit: 0 };
}

function partial(betId: string, stake: number, returned: number): Settlement<BlackjackBetTarget> {
  return { betId, outcome: "partial", returned, profit: returned - stake };
}

function getHand(result: BlackjackResult, target: BlackjackBetTarget): HandInput | undefined {
  const hands = result.seats[target.seat];
  if (!hands?.length) return undefined;
  return hands[target.handIndex ?? 0];
}

function settleMainLike(
  bet: PlacedBet<BlackjackBetTarget>,
  outcome: SeatOutcome | null | undefined,
  rules: BlackjackRules,
  totalStake: number,
): Settlement<BlackjackBetTarget> {
  const { id, amount } = bet;
  if (!outcome) return lose(id, amount);

  switch (outcome) {
    case "surrender":
      return partial(id, totalStake, Math.floor(totalStake / 2));
    case "blackjack": {
      const { num, den } = blackjackPayoutFraction(rules.blackjackPayout);
      const profit = Math.floor((totalStake * num) / den);
      return win(id, totalStake, profit);
    }
    case "win":
      return win(id, totalStake, totalStake);
    case "push":
      return push(id, totalStake);
    case "lose":
    case "bust":
      return lose(id, totalStake);
  }
}

function dealerBlackjackLossScope(rules: BlackjackRules, hand: HandInput): number {
  if (rules.peek) {
    if (hand.doubled || hand.fromSplit) return 0;
  }
  return 1;
}

export function settleBlackjack(input: SettleInput): Settlement<BlackjackBetTarget>[] {
  const { bets, result, rules } = input;
  const dealerUp = result.dealer.cards[0];

  return bets.map((bet) => {
    if (!bet.target) return lose(bet.id, bet.amount);
    const hand = getHand(result, bet.target);
    const handIndex = bet.target.handIndex ?? 0;
    const outcome = hand?.outcome ?? null;

    switch (bet.type as BlackjackBetId) {
      case "even_money":
        if (outcome === "blackjack" && result.dealer.cards[0]?.rank === "A") {
          return win(bet.id, bet.amount, bet.amount);
        }
        return lose(bet.id, bet.amount);

      case "insurance":
        if (result.dealer.blackjack) return win(bet.id, bet.amount, bet.amount * 2);
        return lose(bet.id, bet.amount);

      case "main": {
        const stake = bet.amount;
        if (result.dealer.blackjack && outcome !== "blackjack" && outcome !== "push") {
          const scope = hand ? dealerBlackjackLossScope(rules, hand) : 1;
          if (scope === 0) return push(bet.id, bet.amount);
        }
        return settleMainLike(bet, outcome, rules, stake);
      }

      case "double": {
        if (outcome === "win" || outcome === "blackjack") {
          return win(bet.id, bet.amount, bet.amount * 2);
        }
        if (outcome === "push") return push(bet.id, bet.amount);
        return lose(bet.id, bet.amount);
      }

      case "split":
        return settleMainLike(bet, outcome, rules, bet.amount);

      case "perfect_pairs": {
        if (!rules.sideBets || !hand || hand.cards.length < 2) return lose(bet.id, bet.amount);
        const kind = evaluatePerfectPairs(hand.cards);
        if (!kind) return lose(bet.id, bet.amount);
        const idx = kind === "perfect" ? 0 : kind === "coloured" ? 1 : 2;
        const mult = rules.perfectPairsPayout[idx]!;
        return win(bet.id, bet.amount, bet.amount * mult);
      }

      case "twenty_one_plus_three": {
        if (!rules.sideBets || !hand || hand.cards.length < 2 || !dealerUp) {
          return lose(bet.id, bet.amount);
        }
        const kind = evaluate21Plus3(hand.cards, dealerUp);
        if (!kind) return lose(bet.id, bet.amount);
        const idxMap: Record<string, number> = {
          suited_trips: 0,
          straight_flush: 1,
          three_kind: 2,
          straight: 3,
          flush: 4,
        };
        const mult = rules.twentyOnePlusThreePayout[idxMap[kind]!]!;
        return win(bet.id, bet.amount, bet.amount * mult);
      }

      default:
        return lose(bet.id, bet.amount);
    }
  });
}
