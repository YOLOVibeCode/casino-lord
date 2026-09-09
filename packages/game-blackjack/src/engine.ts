import { rankPoints } from "./cards.js";
import type { BlackjackRules } from "./rules.js";
import type { Card, DealerValidation, HandInput, HandValue, SeatOutcome } from "./types.js";

export function handValue(
  cards: Card[],
  fromSplit = false,
  blackjackAfterSplit = false,
): HandValue {
  let total = 0;
  let acesAsEleven = 0;

  for (const card of cards) {
    if (card.rank === "A") {
      total += 11;
      acesAsEleven++;
    } else {
      total += rankPoints(card.rank);
    }
  }

  while (total > 21 && acesAsEleven > 0) {
    total -= 10;
    acesAsEleven--;
  }

  const soft = acesAsEleven > 0;
  const bust = total > 21;
  const naturalBlackjack =
    cards.length === 2 && total === 21 && (!fromSplit || blackjackAfterSplit);

  return {
    total,
    soft,
    blackjack: naturalBlackjack,
    bust,
    fiveCard21: !bust && total === 21 && cards.length >= 5,
  };
}

export function dealerMustDraw(total: number, soft: boolean, rules: BlackjackRules): boolean {
  if (total > 21) return false;
  if (total < 17) return true;
  if (total === 17 && soft && rules.dealerSoft17 === "hit") return true;
  return false;
}

export function validateDealerPlay(cards: Card[], rules: BlackjackRules): DealerValidation {
  const illegalActions: string[] = [];

  if (cards.length === 0) {
    return { dealerStatus: "must_draw", illegalActions, total: null, soft: false };
  }

  if (cards.length >= 2) {
    const initial = handValue(cards.slice(0, 2));
    if (initial.blackjack) {
      return {
        dealerStatus: "blackjack",
        illegalActions,
        total: initial.total,
        soft: initial.soft,
      };
    }
  }

  for (let i = 2; i < cards.length; i++) {
    const before = handValue(cards.slice(0, i));
    if (before.bust) break;
    if (!dealerMustDraw(before.total, before.soft, rules)) {
      illegalActions.push(
        before.soft && before.total === 17
          ? `Drew on soft 17 (${rules.dealerSoft17 === "stand" ? "S17" : "H17"})`
          : before.total <= 16
            ? `Drew on ${before.total}`
            : `Drew on hard ${before.total}`,
      );
    }
  }

  const hv = handValue(cards);
  if (hv.bust) {
    return { dealerStatus: "bust", illegalActions, total: hv.total, soft: hv.soft };
  }

  if (dealerMustDraw(hv.total, hv.soft, rules)) {
    return { dealerStatus: "must_draw", illegalActions, total: hv.total, soft: hv.soft };
  }

  return { dealerStatus: "stands", illegalActions, total: hv.total, soft: hv.soft };
}

export function resolveSeatOutcome(
  hand: HandInput,
  dealer: { total: number | null; bust: boolean; blackjack: boolean },
  rules: BlackjackRules,
): SeatOutcome {
  if (hand.surrendered) return "surrender";

  if (hand.outcome !== null && hand.cards.length === 0) {
    return hand.outcome;
  }

  const hv = handValue(hand.cards, hand.fromSplit, rules.blackjackAfterSplit);

  if (hv.bust) return "bust";

  if (hv.blackjack && !dealer.blackjack) return "blackjack";
  if (hv.blackjack && dealer.blackjack) return "push";

  if (dealer.blackjack) return "lose";
  if (dealer.bust) return "win";

  const playerTotal = hv.total;
  const dealerTotal = dealer.total ?? 0;

  if (playerTotal > dealerTotal) return "win";
  if (playerTotal < dealerTotal) return "lose";
  return "push";
}

export function resolveHandOutcomes(
  hands: HandInput[],
  dealerCards: Card[],
  rules: BlackjackRules,
): HandInput[] {
  const validation = validateDealerPlay(dealerCards, rules);
  const dealer = {
    total: validation.total,
    bust: validation.dealerStatus === "bust",
    blackjack: validation.dealerStatus === "blackjack",
  };

  return hands.map((hand) => ({
    ...hand,
    outcome: resolveSeatOutcome(hand, dealer, rules),
  }));
}

export function resolveRoundSeats(
  seats: Partial<Record<number, HandInput[]>>,
  dealerCards: Card[],
  rules: BlackjackRules,
): Partial<Record<number, HandInput[]>> {
  const resolved: Partial<Record<number, HandInput[]>> = {};
  for (const [seatKey, hands] of Object.entries(seats)) {
    const seat = Number(seatKey) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    resolved[seat] = resolveHandOutcomes(hands ?? [], dealerCards, rules);
  }
  return resolved;
}

export function canSplit(hands: HandInput[], rules: BlackjackRules): boolean {
  if (hands.length > rules.maxSplits) return false;
  const last = hands[hands.length - 1];
  if (!last || last.cards.length !== 2) return false;
  if (!isPair(last.cards)) return false;
  if (last.cards[0]!.rank === "A" && !rules.resplitAces && hands.length > 1) return false;
  return true;
}

export function isPair(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const val = (c: Card) =>
    c.rank === "10" || c.rank === "J" || c.rank === "Q" || c.rank === "K" ? 10 : rankPoints(c.rank);
  return val(cards[0]!) === val(cards[1]!);
}

export type PerfectPairKind = "perfect" | "coloured" | "mixed" | null;

export function evaluatePerfectPairs(cards: Card[]): PerfectPairKind {
  if (cards.length < 2) return null;
  const [a, b] = cards;
  if (a!.rank !== b!.rank) return null;
  if (a!.suit && b!.suit && a!.suit === b!.suit) return "perfect";
  if (a!.suit && b!.suit) {
    const red = (s: string) => s === "H" || s === "D";
    if (red(a!.suit) === red(b!.suit)) return "coloured";
  }
  return "mixed";
}

export type TwentyOnePlusThreeKind =
  "suited_trips" | "straight_flush" | "three_kind" | "straight" | "flush" | null;

const RANK_ORDER: Record<string, number> = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
};

function rankOrd(rank: string): number {
  return RANK_ORDER[rank] ?? 0;
}

export function evaluate21Plus3(playerCards: Card[], dealerUp: Card): TwentyOnePlusThreeKind {
  if (playerCards.length < 2) return null;
  const cards = [playerCards[0]!, playerCards[1]!, dealerUp];
  const ranks = cards.map((c) => rankOrd(c.rank)).sort((a, b) => a - b);
  const suits = cards.map((c) => c.suit);
  const allSameSuit = suits.every((s) => s && s === suits[0]);
  const allSameRank = cards.every((c) => c.rank === cards[0]!.rank);

  const isStraight =
    (ranks[2]! - ranks[0]! === 2 && ranks[1]! - ranks[0]! === 1) ||
    (ranks[0] === 1 && ranks[1] === 12 && ranks[2] === 13);

  if (allSameRank && allSameSuit) return "suited_trips";
  if (isStraight && allSameSuit) return "straight_flush";
  if (allSameRank) return "three_kind";
  if (isStraight) return "straight";
  if (allSameSuit) return "flush";
  return null;
}

export function blackjackPayoutFraction(payout: BlackjackRules["blackjackPayout"]): {
  num: number;
  den: number;
} {
  switch (payout) {
    case "3:2":
      return { num: 3, den: 2 };
    case "6:5":
      return { num: 6, den: 5 };
    case "2:1":
      return { num: 2, den: 1 };
  }
}

export function computeDealerFromCards(cards: Card[], rules: BlackjackRules) {
  const validation = validateDealerPlay(cards, rules);
  return {
    cards,
    total: validation.total,
    bust: validation.dealerStatus === "bust",
    blackjack: validation.dealerStatus === "blackjack",
  };
}
