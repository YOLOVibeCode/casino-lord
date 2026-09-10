import { handValue } from "./engine.js";
import type { BlackjackRules } from "./rules.js";
import type { BlackjackResult, Seat } from "./types.js";
import { ALL_SEATS } from "./types.js";

export function describeBlackjackResult(
  result: BlackjackResult,
  rules: BlackjackRules,
): string {
  const dealerPart = result.dealer.bust
    ? "Dealer bust"
    : result.dealer.total !== null
      ? `Dealer ${result.dealer.total}`
      : "Dealer";

  for (const seat of ALL_SEATS) {
    const hands = result.seats[seat];
    if (!hands) continue;
    for (const hand of hands) {
      const bust =
        hand.outcome === "bust" ||
        (hand.cards.length > 0 &&
          handValue(hand.cards, hand.fromSplit, rules.blackjackAfterSplit).bust);
      if (bust) {
        return `${dealerPart}, seat ${seat} bust`;
      }
    }
  }

  for (const seat of ALL_SEATS) {
    const hands = result.seats[seat];
    if (!hands) continue;
    for (const hand of hands) {
      if (hand.outcome === "blackjack") {
        return `${dealerPart}, seat ${seat} blackjack`;
      }
    }
  }

  return dealerPart;
}
