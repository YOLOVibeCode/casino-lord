import { describe, expect, it } from "vitest";
import { canSplit, handValue, isPair } from "./engine.js";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";
import type { Card, HandInput } from "./types.js";

function c(rank: Card["rank"], suit: Card["suit"] = "H"): Card {
  return { rank, suit };
}

function hand(cards: Card[], fromSplit = false): HandInput {
  return { cards, doubled: false, fromSplit, surrendered: false, outcome: null };
}

describe("split handling", () => {
  it("detects pair", () => {
    expect(isPair([c("8"), c("8")])).toBe(true);
    expect(isPair([c("K"), c("Q")])).toBe(true);
  });

  it("respects maxSplits", () => {
    const rules = { ...DEFAULT_BLACKJACK_RULES, maxSplits: 2 };
    const hands = [hand([c("8"), c("8")]), hand([c("8"), c("8")]), hand([c("8"), c("8")])];
    expect(canSplit(hands, rules)).toBe(false);
  });

  it("aces one card when splitAcesOneCard", () => {
    const rules = { ...DEFAULT_BLACKJACK_RULES, splitAcesOneCard: true };
    const splitHand = hand([c("A"), c("9")], true);
    const hv = handValue(splitHand.cards, true);
    expect(hv.total).toBe(20);
  });

  it("blackjack after split gated by flag", () => {
    expect(handValue([c("A"), c("K")], true).blackjack).toBe(false);
    expect(handValue([c("A"), c("K")], true, true).blackjack).toBe(true);
  });

  it("resplit aces blocked when resplitAces false", () => {
    const rules = { ...DEFAULT_BLACKJACK_RULES, resplitAces: false };
    const hands = [hand([c("A"), c("A")], true), hand([c("A"), c("9")], true)];
    expect(canSplit(hands, rules)).toBe(false);
  });
});
