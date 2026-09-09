import type { Card, Rank, SlotId, Suit } from "./types.js";

const RANKS: readonly Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: readonly Suit[] = ["S", "H", "D", "C"];

export function cardValue(rank: Rank): number {
  if (rank === "A") return 1;
  if (rank === "10" || rank === "J" || rank === "Q" || rank === "K") return 0;
  return Number(rank);
}

export function totalValue(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + cardValue(c.rank), 0) % 10;
}

export function cardKey(card: Card): string {
  return `${card.rank}:${card.suit ?? ""}`;
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function findDuplicateCards(slots: Partial<Record<SlotId, Card>>): string[] {
  const entries = Object.entries(slots).filter(([, c]) => c !== undefined) as [SlotId, Card][];
  const warnings: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [slotA, cardA] = entries[i]!;
      const [slotB, cardB] = entries[j]!;
      if (cardsEqual(cardA, cardB)) {
        warnings.push(`Duplicate card ${formatCard(cardA)} in ${slotA} and ${slotB}`);
      }
    }
  }
  return warnings;
}

export function formatCard(card: Card): string {
  const rank = card.rank === "10" ? "T" : card.rank;
  const suit = card.suit ?? "";
  return `${rank}${suit}`;
}

export function parseCardToken(token: string): Card {
  const trimmed = token.trim();
  if (!trimmed) throw new Error(`Empty card token`);

  let rankPart: string;
  let suitPart: string | null = null;

  if (trimmed.length >= 2 && SUITS.includes(trimmed.slice(-1) as Suit)) {
    suitPart = trimmed.slice(-1) as Suit;
    rankPart = trimmed.slice(0, -1);
  } else {
    rankPart = trimmed;
  }

  const rank = parseRank(rankPart);
  return { rank, suit: suitPart as Suit | null };
}

function parseRank(part: string): Rank {
  const upper = part.toUpperCase();
  if (upper === "T" || upper === "10") return "10";
  if (RANKS.includes(upper as Rank)) return upper as Rank;
  throw new Error(`Invalid rank: ${part}`);
}

export function parseCardList(text: string): Card[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map(parseCardToken);
}

export function maxShoeCards(decks: number): number {
  return decks * 52;
}
