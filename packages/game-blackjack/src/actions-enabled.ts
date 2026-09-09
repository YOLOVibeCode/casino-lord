import type { PlayerState } from "@casino-lord/core";
import { canSplit, handValue } from "./engine.js";
import type { BlackjackRules } from "./rules.js";
import type { BlackjackState } from "./state.js";
import type { HandInput, Seat } from "./types.js";
import { dealerShowsAce, getPendingTurn, isHandComplete, isInsuranceWindow } from "./turn.js";
import type { BlackjackAction } from "./virtual.js";

function playerSeat(me: PlayerState): Seat | undefined {
  const seat = me.player.seat;
  if (seat === undefined || seat < 1 || seat > 7) return undefined;
  return seat as Seat;
}

function activeHand(
  state: BlackjackState,
  rules: BlackjackRules,
  me: PlayerState,
): { hand: HandInput; handIndex: number; seat: Seat } | null {
  const pending = getPendingTurn(state, rules);
  const seat = playerSeat(me);
  if (!pending || seat !== pending.seat) return null;
  const hand = state.liveInput.seats[seat]?.[pending.handIndex];
  if (!hand) return null;
  return { hand, handIndex: pending.handIndex, seat };
}

export function isMyTurn(state: BlackjackState, me: PlayerState, rules: BlackjackRules): boolean {
  const pending = getPendingTurn(state, rules);
  const seat = playerSeat(me);
  return pending !== null && seat === pending.seat;
}

export function canHit(state: BlackjackState, me: PlayerState, rules: BlackjackRules): boolean {
  return activeHand(state, rules, me) !== null;
}

export function canStand(state: BlackjackState, me: PlayerState, rules: BlackjackRules): boolean {
  return activeHand(state, rules, me) !== null;
}

export function canDouble(state: BlackjackState, me: PlayerState, rules: BlackjackRules): boolean {
  const ctx = activeHand(state, rules, me);
  if (!ctx) return false;
  const { hand } = ctx;
  if (hand.doubled || (hand.fromSplit && !rules.doubleAfterSplit)) return false;
  if (hand.cards.length !== 2) return false;
  const completed = state.liveInput.virtual?.completedHands ?? [];
  if (isHandComplete(hand, ctx.seat, ctx.handIndex, rules, completed)) return false;
  return true;
}

export function canSplitHand(
  state: BlackjackState,
  me: PlayerState,
  rules: BlackjackRules,
): boolean {
  const ctx = activeHand(state, rules, me);
  if (!ctx) return false;
  const hands = state.liveInput.seats[ctx.seat] ?? [];
  return canSplit(hands, rules);
}

export function canSurrender(
  state: BlackjackState,
  me: PlayerState,
  rules: BlackjackRules,
): boolean {
  if (rules.surrender === "none") return false;
  const ctx = activeHand(state, rules, me);
  if (!ctx) return false;
  const { hand } = ctx;
  if (hand.surrendered || hand.doubled) return false;
  if (hand.cards.length !== 2) return false;
  if (hand.fromSplit) return false;
  return true;
}

export function canPlaceInsurance(state: BlackjackState, rules: BlackjackRules): boolean {
  if (!isInsuranceWindow(state) || !dealerShowsAce(state)) return false;
  return true;
}

export function canPlaceEvenMoney(
  state: BlackjackState,
  rules: BlackjackRules,
  seat: Seat,
): boolean {
  if (!isInsuranceWindow(state) || !dealerShowsAce(state)) return false;
  const hand = state.liveInput.seats[seat]?.[0];
  if (!hand) return false;
  const hv = handValue(hand.cards, hand.fromSplit, rules.blackjackAfterSplit);
  return hv.blackjack;
}

export function isActionEnabled(
  action: BlackjackAction,
  state: BlackjackState,
  me: PlayerState,
  rules: BlackjackRules,
): boolean {
  switch (action) {
    case "hit":
      return canHit(state, me, rules);
    case "stand":
      return canStand(state, me, rules);
    case "double":
      return canDouble(state, me, rules);
    case "split":
      return canSplitHand(state, me, rules);
    case "surrender":
      return canSurrender(state, me, rules);
  }
}
