import { formatCard } from "../cards.js";
import { handValue } from "../engine.js";
import type { BlackjackRules } from "../rules.js";
import type { Card, HandInput, SeatOutcome, Suit } from "../types.js";

const SUIT_GLYPH: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

export function isRedSuit(suit: Suit | null): boolean {
  return suit === "H" || suit === "D";
}

export function formatCardGlyph(card: Card): string {
  const glyph = card.suit ? SUIT_GLYPH[card.suit] : "";
  return `${card.rank}${glyph}`;
}

export function formatCardList(cards: Card[]): string {
  return cards.map(formatCardGlyph).join(" ");
}

export function handTotalLabel(
  hand: HandInput,
  rules: BlackjackRules,
): { total: number | null; label: string } {
  if (hand.outcome !== null && hand.cards.length === 0) {
    return { total: null, label: outcomeDisplayLabel(hand.outcome) };
  }
  const hv = handValue(hand.cards, hand.fromSplit, rules.blackjackAfterSplit);
  if (hv.blackjack) return { total: hv.total, label: "BLACKJACK" };
  if (hv.bust) return { total: hv.total, label: "BUST" };
  const soft = hv.soft ? " soft" : "";
  return { total: hv.total, label: `= ${hv.total}${soft}` };
}

export function outcomeDisplayLabel(outcome: SeatOutcome): string {
  switch (outcome) {
    case "win":
      return "WIN";
    case "lose":
      return "LOSE";
    case "push":
      return "PUSH";
    case "blackjack":
      return "BLACKJACK";
    case "bust":
      return "BUST";
    case "surrender":
      return "SURRENDER";
  }
}

export function outcomeColor(outcome: SeatOutcome | null): string {
  switch (outcome) {
    case "win":
      return "#2BB673";
    case "blackjack":
      return "#D4AF37";
    case "lose":
    case "bust":
      return "#D7263D";
    case "push":
    case "surrender":
      return "#9AA0A6";
    default:
      return "#EDE6D6";
  }
}

export function dealerStatusLabel(status: string, total: number | null, soft: boolean): string {
  switch (status) {
    case "must_draw":
      return total !== null ? `Dealer ${total} — must draw` : "Enter dealer cards";
    case "bust":
      return `DEALER BUST ${total ?? ""}`.trim();
    case "blackjack":
      return "DEALER BLACKJACK";
    case "stands":
      return `DEALER ${total ?? ""}${soft ? " soft" : ""} — stands`.trim();
    default:
      return "";
  }
}

export function formatCardForExport(card: Card): string {
  return formatCard(card);
}
