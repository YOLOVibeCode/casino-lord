import { maxShoeCards } from "./cards.js";
import type { BlackjackRules } from "./rules.js";
import type { Card, Seat } from "./types.js";

const CARDS_PER_HAND_ESTIMATE = 2.7;

export class ShoeTracker {
  private exactCount = 0;
  private estimatedExtra = 0;
  private readonly maxCards: number;
  private useEstimate = false;

  constructor(rules: BlackjackRules) {
    this.maxCards = maxShoeCards(rules.decks);
  }

  setEstimateMode(enabled: boolean): void {
    this.useEstimate = enabled;
  }

  addCards(cards: Card[]): string[] {
    const errors: string[] = [];
    for (const _card of cards) {
      if (this.exactCount >= this.maxCards) {
        errors.push(`Shoe limit reached (${this.maxCards} cards)`);
        return errors;
      }
      this.exactCount++;
    }
    return errors;
  }

  addEstimatedHands(activeHands: number): void {
    if (this.useEstimate) {
      this.estimatedExtra += Math.ceil(activeHands * CARDS_PER_HAND_ESTIMATE);
    }
  }

  resetEstimate(): void {
    this.estimatedExtra = 0;
  }

  get seenCount(): number {
    return this.exactCount + (this.useEstimate ? this.estimatedExtra : 0);
  }

  get exactSeen(): number {
    return this.exactCount;
  }

  get cardsTotal(): number {
    return this.maxCards;
  }

  penetrationPct(): number {
    return this.maxCards > 0 ? Math.round((this.seenCount / this.maxCards) * 100) : 0;
  }
}

export function countActiveHands(seats: Partial<Record<Seat, { cards: Card[] }[]>>): number {
  let count = 0;
  for (const hands of Object.values(seats)) {
    if (hands && hands.length > 0) count += hands.length;
  }
  return count;
}
