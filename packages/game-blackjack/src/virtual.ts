import type { Rng, TableEvent, VirtualTrigger } from "@casino-lord/core";
import { dealerMustDraw, handValue, isPair } from "./engine.js";
import { liveInputToResult } from "./round-state.js";
import type { BlackjackRules } from "./rules.js";
import type { BlackjackState } from "./state.js";
import type { Card, HandInput, Rank, Seat, Suit, VirtualSession } from "./types.js";
import { ALL_SEATS } from "./types.js";

export type BlackjackAction = "hit" | "stand" | "double" | "split" | "surrender";

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: Suit[] = ["S", "H", "D", "C"];

export function buildShoe(decks: number, rng: Rng): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ rank, suit });
      }
    }
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = rng.next(i + 1);
    [shoe[i], shoe[j]] = [shoe[j]!, shoe[i]!];
  }
  return shoe;
}

function draw(session: VirtualSession): Card {
  const card = session.shoe[session.shoeIndex]!;
  session.shoeIndex++;
  return card;
}

function emptyHand(): HandInput {
  return { cards: [], doubled: false, fromSplit: false, surrendered: false, outcome: null };
}

function handKey(seat: Seat, index: number): string {
  return `${seat}:${index}`;
}

function isHandComplete(
  hand: HandInput,
  seat: Seat,
  handIndex: number,
  session: VirtualSession,
  rules: BlackjackRules,
): boolean {
  if (session.completedHands.includes(handKey(seat, handIndex))) return true;
  if (hand.surrendered) return true;
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

function initSession(rules: BlackjackRules, rng: Rng, activeSeats: Seat[]): VirtualSession {
  return {
    shoe: buildShoe(rules.decks, rng),
    shoeIndex: 0,
    phase: "deal",
    activeSeats,
    currentSeat: null,
    currentHandIndex: 0,
    holeDealt: false,
    dealRound: 0,
    completedHands: [],
  };
}

function advancePlayerTurn(
  session: VirtualSession,
  seats: Partial<Record<Seat, HandInput[]>>,
  rules: BlackjackRules,
): void {
  for (const seat of session.activeSeats) {
    const hands = seats[seat] ?? [emptyHand()];
    for (let hi = 0; hi < hands.length; hi++) {
      const hand = hands[hi]!;
      if (!isHandComplete(hand, seat, hi, session, rules)) {
        session.currentSeat = seat;
        session.currentHandIndex = hi;
        session.phase = "player";
        return;
      }
    }
  }
  session.phase = "dealer";
  session.currentSeat = null;
}

function cloneSeats(seats: Partial<Record<Seat, HandInput[]>>): Partial<Record<Seat, HandInput[]>> {
  return JSON.parse(JSON.stringify(seats)) as Partial<Record<Seat, HandInput[]>>;
}

export function blackjackVirtualStep(input: {
  state: BlackjackState;
  rules: BlackjackRules;
  rng: Rng;
  trigger: VirtualTrigger;
  action?: { playerId: string; action: BlackjackAction };
}): { events: Omit<TableEvent, "seq" | "at">[]; awaiting: "none" | "action" | "trigger" } {
  const { state, rules, rng, trigger, action } = input;
  let session = state.liveInput.virtual ?? null;
  let dealer = [...state.liveInput.dealer];
  let seats = cloneSeats(state.liveInput.seats);
  const events: Omit<TableEvent, "seq" | "at">[] = [];

  const pushLive = () => {
    events.push({
      type: "LIVE_INPUT",
      payload: { dealer, seats, virtual: session ?? undefined },
      source: "system",
    } as Omit<TableEvent, "seq" | "at">);
  };

  if (trigger === "deal" && !session) {
    const activeSeats = (ALL_SEATS.filter((s) => s <= rules.seats).slice(0, 1) as Seat[]) || [1];
    session = initSession(rules, rng, activeSeats);
    for (const seat of session.activeSeats) {
      seats[seat] = [emptyHand()];
    }
  }

  if (!session) return { events, awaiting: "trigger" };

  if (session.phase === "deal") {
    if (session.dealRound === 0) {
      for (const seat of session.activeSeats) {
        seats[seat]![0]!.cards.push(draw(session));
      }
      dealer.push(draw(session));
      session.dealRound = 1;
    } else if (session.dealRound === 1) {
      for (const seat of session.activeSeats) {
        seats[seat]![0]!.cards.push(draw(session));
      }
      if (rules.peek) {
        dealer.push(draw(session));
        session.holeDealt = true;
      }
      session.dealRound = 2;
      session.phase = "insurance";
    } else {
      if (!rules.peek && !session.holeDealt) {
        dealer.push(draw(session));
        session.holeDealt = true;
      }
      advancePlayerTurn(session, seats, rules);
    }
    pushLive();
    return {
      events,
      awaiting: (session.phase as VirtualSession["phase"]) === "player" ? "action" : "trigger",
    };
  }

  if (session.phase === "insurance") {
    const dealerHv = handValue(dealer);
    if (rules.peek && dealerHv.blackjack) {
      const result = liveInputToResult({ dealer, seats }, rules, "full");
      events.push({
        type: "RESULT_RECORDED",
        result: {
          id: "virtual",
          index: state.rounds.length,
          recordedAt: "1970-01-01T00:00:00.000Z",
          quick: false,
          source: "virtual",
          by: "system",
          data: result,
        },
      } as Omit<TableEvent, "seq" | "at">);
      return { events, awaiting: "none" };
    }
    advancePlayerTurn(session, seats, rules);
    pushLive();
    return {
      events,
      awaiting: (session.phase as VirtualSession["phase"]) === "player" ? "action" : "trigger",
    };
  }

  if (session.phase === "player") {
    const seat = session.currentSeat!;
    const handIndex = session.currentHandIndex;
    let hands = seats[seat] ?? [emptyHand()];
    const hand = hands[handIndex]!;

    if (!action) {
      if (rules.autoHitLow) {
        const hv = handValue(hand.cards, hand.fromSplit, rules.blackjackAfterSplit);
        if (hv.total <= 11) {
          return blackjackVirtualStep({
            ...input,
            action: { playerId: "auto", action: "hit" },
          });
        }
      }
      session.completedHands.push(handKey(seat, handIndex));
      advancePlayerTurn(session, seats, rules);
      pushLive();
      return { events, awaiting: session.phase === "player" ? "action" : "trigger" };
    }

    switch (action.action) {
      case "hit":
        hand.cards.push(draw(session));
        break;
      case "stand":
        session.completedHands.push(handKey(seat, handIndex));
        break;
      case "double":
        hand.doubled = true;
        hand.cards.push(draw(session));
        session.completedHands.push(handKey(seat, handIndex));
        break;
      case "split": {
        if (isPair(hand.cards) && hands.length <= rules.maxSplits) {
          const [c0, c1] = hand.cards;
          hand.cards = [c0!, draw(session)];
          hand.fromSplit = true;
          hands = [...hands, { ...emptyHand(), cards: [c1!, draw(session)], fromSplit: true }];
          seats[seat] = hands;
        }
        break;
      }
      case "surrender":
        hand.surrendered = true;
        hand.outcome = "surrender";
        session.completedHands.push(handKey(seat, handIndex));
        break;
    }

    const hv = handValue(hand.cards, hand.fromSplit, rules.blackjackAfterSplit);
    if (hv.bust) {
      hand.outcome = "bust";
      session.completedHands.push(handKey(seat, handIndex));
    }

    advancePlayerTurn(session, seats, rules);
    pushLive();
    return { events, awaiting: session.phase === "player" ? "action" : "trigger" };
  }

  if (session.phase === "dealer") {
    if (!rules.peek && !session.holeDealt) {
      dealer.push(draw(session));
      session.holeDealt = true;
    }

    let hv = handValue(dealer);
    while (dealerMustDraw(hv.total, hv.soft, rules)) {
      dealer.push(draw(session));
      hv = handValue(dealer);
    }

    const result = liveInputToResult({ dealer, seats }, rules, "full");
    events.push({
      type: "RESULT_RECORDED",
      result: {
        id: "virtual",
        index: state.rounds.length,
        recordedAt: "1970-01-01T00:00:00.000Z",
        quick: false,
        source: "virtual",
        by: "system",
        data: result,
      },
    } as Omit<TableEvent, "seq" | "at">);
    return { events, awaiting: "none" };
  }

  return { events, awaiting: "none" };
}

export function createDeterministicRng(seed: number): Rng {
  let s = seed;
  return {
    next(n: number): number {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s % n;
    },
  };
}
