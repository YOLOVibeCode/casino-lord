import { handValue } from "./engine.js";
import type { BlackjackRules } from "./rules.js";
import type { BlackjackState } from "./state.js";
import type { HandInput, Seat } from "./types.js";
import { ALL_SEATS } from "./types.js";

/** Matches platform default `settings.virtual.actionTimerSec` (SPEC.md §14.5). */
export const ACTION_TIMER_MS = 20_000;

export const TURN_PROMPT = "Your move: HIT · STAND · …";

export function handKey(seat: Seat, index: number): string {
  return `${seat}:${index}`;
}

export function isHandComplete(
  hand: HandInput,
  seat: Seat,
  handIndex: number,
  rules: BlackjackRules,
  completedHands: readonly string[] = [],
): boolean {
  if (completedHands.includes(handKey(seat, handIndex))) return true;
  if (hand.surrendered) return true;
  if (hand.outcome !== null) return true;
  const hv = handValue(hand.cards, hand.fromSplit, rules.blackjackAfterSplit);
  if (hv.bust || hv.blackjack) return true;
  if (hand.doubled && hand.cards.length >= 3) return true;
  if (
    hand.fromSplit &&
    hand.cards[0]?.rank === "A" &&
    rules.splitAcesOneCard &&
    hand.cards.length >= 2
  ) {
    return true;
  }
  return false;
}

export interface PendingTurn {
  seat: Seat;
  handIndex: number;
}

export function findPendingTurn(
  seats: Partial<Record<Seat, HandInput[]>>,
  seatOrder: readonly Seat[],
  rules: BlackjackRules,
  completedHands: readonly string[] = [],
): PendingTurn | null {
  for (const seat of seatOrder) {
    const hands = seats[seat];
    if (!hands?.length) continue;
    for (let hi = 0; hi < hands.length; hi++) {
      const hand = hands[hi]!;
      if (!isHandComplete(hand, seat, hi, rules, completedHands)) {
        return { seat, handIndex: hi };
      }
    }
  }
  return null;
}

export function getPendingTurn(state: BlackjackState, rules: BlackjackRules): PendingTurn | null {
  const { liveInput } = state;
  const virtual = liveInput.virtual;

  if (
    virtual?.phase === "insurance" ||
    virtual?.phase === "deal" ||
    virtual?.phase === "dealer" ||
    virtual?.phase === "complete"
  ) {
    return null;
  }

  if (virtual?.phase === "player") {
    const seat = virtual.currentSeat;
    if (seat === null) return null;
    const handIndex = virtual.currentHandIndex;
    const hand = liveInput.seats[seat]?.[handIndex];
    if (!hand || isHandComplete(hand, seat, handIndex, rules, virtual.completedHands)) {
      return null;
    }
    return { seat, handIndex };
  }

  const seatOrder = ALL_SEATS.filter((s) => s <= rules.seats);
  const hasLive =
    liveInput.dealer.length > 0 || seatOrder.some((s) => (liveInput.seats[s]?.length ?? 0) > 0);
  if (!hasLive) return null;
  const activeSeats =
    virtual?.activeSeats ?? seatOrder.filter((s) => (liveInput.seats[s]?.length ?? 0) > 0);
  return findPendingTurn(liveInput.seats, activeSeats, rules, virtual?.completedHands ?? []);
}

export function getPendingSeat(state: BlackjackState, rules: BlackjackRules): Seat | null {
  return getPendingTurn(state, rules)?.seat ?? null;
}

export function blackjackTurn(
  state: BlackjackState,
  rules: BlackjackRules,
): { playerId: string | null; prompt: string; deadlineMs?: number } | null {
  const pending = getPendingTurn(state, rules);
  if (!pending) return null;

  const virtual = state.liveInput.virtual;
  let deadlineMs: number | undefined;
  if (virtual?.turnStartedAt) {
    deadlineMs = Date.parse(virtual.turnStartedAt) + ACTION_TIMER_MS;
  }

  return {
    playerId: null,
    prompt: TURN_PROMPT,
    ...(deadlineMs !== undefined ? { deadlineMs } : {}),
  };
}

export function isInsuranceWindow(state: BlackjackState): boolean {
  return state.liveInput.virtual?.phase === "insurance";
}

export function dealerShowsAce(state: BlackjackState): boolean {
  return state.liveInput.dealer[0]?.rank === "A";
}
