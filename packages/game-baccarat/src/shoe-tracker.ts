import { maxShoeCards } from "./cards.js";
import type { BaccaratRules } from "./rules.js";
import type { Card, SlotId } from "./types.js";

export class ShoeTracker {
  private count = 0;
  private readonly maxCards: number;

  constructor(rules: BaccaratRules) {
    this.maxCards = maxShoeCards(rules.decks);
  }

  addFromSlots(slots: Partial<Record<SlotId, Card>>): string[] {
    const errors: string[] = [];
    for (const card of Object.values(slots)) {
      if (!card) continue;
      if (this.count >= this.maxCards) {
        errors.push(`Shoe limit reached (${this.maxCards} cards)`);
        return errors;
      }
      this.count++;
    }
    return errors;
  }

  get seenCount(): number {
    return this.count;
  }
}
