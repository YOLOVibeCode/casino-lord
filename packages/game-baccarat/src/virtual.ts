import type { Rng, TableEvent, VirtualTrigger } from "@casino-lord/core";
import { cardValue } from "./cards.js";
import { evaluateHand } from "./engine.js";
import type { BaccaratRules } from "./rules.js";
import type { BaccaratState } from "./state.js";
import type { BaccaratLiveInput, BaccaratResult, Card, Rank, SlotId, Suit } from "./types.js";

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: Suit[] = ["S", "H", "D", "C"];
const DEAL_ORDER: SlotId[] = ["P1", "B1", "P2", "B2", "P3", "B3"];
const CUT_RESERVE = 14;
const MIN_HAND_CARDS = 6;

export interface VirtualShoeSession {
  shoe: Card[];
  shoeIndex: number;
  burned: boolean;
}

export function shoePenetration(rules: BaccaratRules): number {
  return 1 - CUT_RESERVE / (rules.decks * 52);
}

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

function remainingCards(session: VirtualShoeSession): number {
  return session.shoe.length - session.shoeIndex;
}

function needsSeriesRollover(session: VirtualShoeSession): boolean {
  return remainingCards(session) <= CUT_RESERVE || remainingCards(session) < MIN_HAND_CARDS;
}

function drawCard(session: VirtualShoeSession): Card {
  const card = session.shoe[session.shoeIndex]!;
  session.shoeIndex++;
  return card;
}

function applyBurn(session: VirtualShoeSession, rules: BaccaratRules): void {
  if (session.burned || rules.burnRule === "none") {
    session.burned = true;
    return;
  }
  const first = drawCard(session);
  const burnCount = cardValue(first.rank);
  for (let i = 0; i < burnCount; i++) {
    drawCard(session);
  }
  session.burned = true;
}

function initSession(rules: BaccaratRules, rng: Rng): VirtualShoeSession {
  const session: VirtualShoeSession = {
    shoe: buildShoe(rules.decks, rng),
    shoeIndex: 0,
    burned: false,
  };
  applyBurn(session, rules);
  return session;
}

function slotsFromPartial(partial: Partial<Record<SlotId, Card>>): BaccaratLiveInput {
  return { slots: { ...partial } };
}

function buildResult(slots: Partial<Record<SlotId, Card>>, rules: BaccaratRules): BaccaratResult {
  const hand = evaluateHand(slots, rules);
  const cards = { ...slots };
  return {
    cards,
    outcome: hand.outcome!,
    playerTotal: hand.playerTotal,
    bankerTotal: hand.bankerTotal,
    playerPair: hand.playerPair,
    bankerPair: hand.bankerPair,
    natural: hand.playerNatural || hand.bankerNatural,
  };
}

function dealHand(
  session: VirtualShoeSession,
  rules: BaccaratRules,
): Partial<Record<SlotId, Card>> {
  const slots: Partial<Record<SlotId, Card>> = {};
  slots.P1 = drawCard(session);
  slots.B1 = drawCard(session);
  slots.P2 = drawCard(session);
  slots.B2 = drawCard(session);

  let hand = evaluateHand(slots, rules);
  if (hand.status === "complete") {
    return slots;
  }

  if (hand.status === "needs_player_third") {
    slots.P3 = drawCard(session);
    hand = evaluateHand(slots, rules);
  }

  if (hand.status === "needs_banker_third") {
    slots.B3 = drawCard(session);
  }

  return slots;
}

export interface BaccaratVirtualStepResult {
  events: Omit<TableEvent, "seq" | "at">[];
  awaiting: "none" | "action" | "trigger";
  session: VirtualShoeSession | null;
  seriesRollover: boolean;
}

export function baccaratVirtualStep(input: {
  state: BaccaratState;
  rules: BaccaratRules;
  rng: Rng;
  trigger: VirtualTrigger;
  session: VirtualShoeSession | null;
  seriesId: string;
}): BaccaratVirtualStepResult {
  void input.state;
  void input.trigger;

  let session = input.session;
  if (!session) {
    session = initSession(input.rules, input.rng);
  }

  const events: Omit<TableEvent, "seq" | "at">[] = [];

  if (needsSeriesRollover(session)) {
    return {
      events: [
        { type: "SERIES_ENDED", seriesId: input.seriesId } as Omit<TableEvent, "seq" | "at">,
        {
          type: "SERIES_STARTED",
          seriesId: `${input.seriesId}-next`,
          auto: true,
        } as Omit<TableEvent, "seq" | "at">,
      ],
      awaiting: "trigger",
      session: null,
      seriesRollover: true,
    };
  }

  const finalSlots = dealHand(session, input.rules);
  const revealOrder: SlotId[] = [];
  for (const slot of DEAL_ORDER) {
    if (finalSlots[slot]) {
      revealOrder.push(slot);
    }
  }

  const progressive: Partial<Record<SlotId, Card>> = {};
  for (const slot of revealOrder) {
    progressive[slot] = finalSlots[slot]!;
    events.push({
      type: "LIVE_INPUT",
      payload: slotsFromPartial(progressive),
      source: "system",
    } as Omit<TableEvent, "seq" | "at">);
  }

  const result = buildResult(finalSlots, input.rules);
  const rngRange = input.rng.draws ?? { from: 0, to: 0 };

  events.push({
    type: "RESULT_RECORDED",
    result: {
      id: "virtual-pending",
      index: 0,
      recordedAt: "",
      quick: false,
      source: "virtual",
      by: "system",
      rng: rngRange,
      data: result,
    },
  } as Omit<TableEvent, "seq" | "at">);

  if (needsSeriesRollover(session)) {
    events.push(
      { type: "SERIES_ENDED", seriesId: input.seriesId } as Omit<TableEvent, "seq" | "at">,
      {
        type: "SERIES_STARTED",
        seriesId: `${input.seriesId}-next`,
        auto: true,
      } as Omit<TableEvent, "seq" | "at">,
    );
    return {
      events,
      awaiting: "trigger",
      session: null,
      seriesRollover: true,
    };
  }

  return {
    events,
    awaiting: "none",
    session,
    seriesRollover: false,
  };
}

export function baccaratVirtualDecks(rules: BaccaratRules): number {
  return rules.decks;
}
