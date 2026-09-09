import { describe, expect, it } from "vitest";
import { handValue } from "./engine.js";
import type { Card } from "./types.js";

function c(rank: Card["rank"], suit: Card["suit"] = "H"): Card {
  return { rank, suit };
}

describe("handValue", () => {
  it("handles multi-ace soft to hard transition", () => {
    expect(handValue([c("A"), c("A"), c("9")])).toEqual({
      total: 21,
      soft: true,
      blackjack: false,
      bust: false,
      fiveCard21: false,
    });
    expect(handValue([c("A"), c("A"), c("9"), c("5")])).toEqual({
      total: 16,
      soft: false,
      blackjack: false,
      bust: false,
      fiveCard21: false,
    });
  });

  it("handles soft 17", () => {
    const hv = handValue([c("A"), c("6")]);
    expect(hv.total).toBe(17);
    expect(hv.soft).toBe(true);
  });

  it("detects 5+ card 21", () => {
    const hv = handValue([c("2"), c("3"), c("4"), c("5"), c("7")]);
    expect(hv.total).toBe(21);
    expect(hv.fiveCard21).toBe(true);
  });

  it("detects natural blackjack", () => {
    expect(handValue([c("A"), c("K")]).blackjack).toBe(true);
    expect(handValue([c("A"), c("K")], true).blackjack).toBe(false);
    expect(handValue([c("A"), c("K")], true, true).blackjack).toBe(true);
  });
});
