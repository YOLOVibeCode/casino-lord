import { cardValue } from "../cards.js";
import type { Card, Rank, SlotId, Suit } from "../types.js";

export const SUIT_GLYPH: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

export const PLAYER_SLOTS: SlotId[] = ["P1", "P2", "P3"];
export const BANKER_SLOTS: SlotId[] = ["B1", "B2", "B3"];

export function isRedSuit(suit: Suit | null): boolean {
  return suit === "H" || suit === "D";
}

export function formatSlotCard(card: Card): string {
  const glyph = card.suit ? (SUIT_GLYPH[card.suit] ?? "") : "";
  return `${card.rank}${glyph}`;
}

export function formatCardList(cards: Partial<Record<SlotId, Card>>, slots: SlotId[]): string {
  return slots
    .map((slot) => cards[slot])
    .filter(Boolean)
    .map((card) => formatSlotCard(card!))
    .join(" ");
}

export function cardValueLabel(rank: Rank): number {
  return cardValue(rank);
}

export function outcomeDisplayLabel(outcome: "P" | "B" | "T"): string {
  switch (outcome) {
    case "P":
      return "PLAYER";
    case "B":
      return "BANKER";
    case "T":
      return "TIE";
  }
}
