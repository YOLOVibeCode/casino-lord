import { describe, expect, it } from "vitest";
import { cardValue } from "./cards.js";
import { bankerDraws, evaluateHand, slotsFromHands } from "./engine.js";
import { DEFAULT_BACCARAT_RULES } from "./rules.js";
import { ShoeTracker } from "./shoe-tracker.js";
import type { Card, Rank, SlotId } from "./types.js";

function card(rank: Rank, suit: "H" | "D" | "S" | "C" = "H"): Card {
  return { rank, suit };
}

function slots(cards: Partial<Record<SlotId, Card>>) {
  return evaluateHand(cards, DEFAULT_BACCARAT_RULES);
}

describe("bankerDraws", () => {
  it("draws on 0-5 when player stood", () => {
    for (let total = 0; total <= 5; total++) {
      expect(bankerDraws(total, null)).toBe(true);
    }
    expect(bankerDraws(6, null)).toBe(false);
    expect(bankerDraws(7, null)).toBe(false);
  });

  it("covers the exhaustive player-third × banker-total matrix", () => {
    for (let p3 = 0; p3 <= 9; p3++) {
      for (let bTotal = 0; bTotal <= 9; bTotal++) {
        const draws = bankerDraws(bTotal, p3);
        if (bTotal <= 2) expect(draws).toBe(true);
        else if (bTotal === 3) expect(draws).toBe(p3 !== 8);
        else if (bTotal === 4) expect(draws).toBe(p3 >= 2 && p3 <= 7);
        else if (bTotal === 5) expect(draws).toBe(p3 >= 4 && p3 <= 7);
        else if (bTotal === 6) expect(draws).toBe(p3 === 6 || p3 === 7);
        else expect(draws).toBe(false);
      }
    }
  });
});

describe("evaluateHand", () => {
  it("prompts for the next deal slot", () => {
    expect(slots({ P1: card("7") }).hint).toBe("Deal Banker card 1");
    expect(slots({ P1: card("7"), B1: card("4"), P2: card("K") }).nextSlot).toBe("B2");
  });

  it("detects naturals and rejects third cards", () => {
    const natural = slots({
      P1: card("7"),
      B1: card("4"),
      P2: card("K"),
      B2: card("5"),
    });
    expect(natural.status).toBe("complete");
    expect(natural.bankerNatural).toBe(true);
    expect(natural.hint).toContain("NATURAL");

    const invalid = evaluateHand(
      {
        P1: card("7"),
        B1: card("4"),
        P2: card("K"),
        B2: card("5"),
        P3: card("2"),
      },
      DEFAULT_BACCARAT_RULES,
    );
    expect(invalid.errors.some((e) => e.slot === "P3")).toBe(true);
  });

  it("requires player third on 0-5 and banker per appendix A", () => {
    const needsP3 = slots({
      P1: card("2"),
      B1: card("3"),
      P2: card("3"),
      B2: card("2"),
    });
    expect(needsP3.status).toBe("needs_player_third");
    expect(needsP3.hint).toContain("Player draws");

    const complete = slots({
      P1: card("4"),
      B1: card("3"),
      P2: card("2"),
      B2: card("2"),
      B3: card("3"),
    });
    expect(complete.status).toBe("complete");
    expect(complete.outcome).toBe("B");
  });

  it("resolves ties", () => {
    const tie = slots({
      P1: card("3"),
      B1: card("2"),
      P2: card("3"),
      B2: card("4"),
    });
    expect(tie.outcome).toBe("T");
    expect(tie.hint).toContain("TIE");
  });

  it("detects pairs", () => {
    const hand = slots({
      P1: card("Q"),
      B1: card("4"),
      P2: card("Q"),
      B2: card("5"),
    });
    expect(hand.playerPair).toBe(true);
    expect(hand.bankerPair).toBe(false);
  });

  it("warns on duplicate cards within a hand", () => {
    const dup = slots({
      P1: card("7", "H"),
      B1: card("4"),
      P2: card("7", "H"),
      B2: card("5"),
    });
    expect(dup.warnings.some((w) => w.includes("Duplicate"))).toBe(true);
  });

  it("blocks shoe over-count", () => {
    const rules = { ...DEFAULT_BACCARAT_RULES, decks: 6 as const };
    const tracker = new ShoeTracker(rules);
    const filler = card("2", "H");
    for (let i = 0; i < 312; i++) {
      tracker.addFromSlots({ P1: filler });
    }
    const state = evaluateHand({ P1: card("3", "D") }, rules, { shoeTracker: tracker });
    expect(state.errors.some((e) => e.message.includes("Shoe limit"))).toBe(true);
  });

  it("recomputes from card lists via slotsFromHands", () => {
    const player = [card("7", "H"), card("K", "S")];
    const banker = [card("4", "D"), card("5", "C")];
    const state = evaluateHand(slotsFromHands(player, banker), DEFAULT_BACCARAT_RULES);
    expect(state.outcome).toBe("B");
    expect(state.bankerTotal).toBe(9);
  });
});

describe("cardValue", () => {
  it("matches spec values", () => {
    expect(cardValue("A")).toBe(1);
    expect(cardValue("10")).toBe(0);
    expect(cardValue("K")).toBe(0);
    expect(cardValue("5")).toBe(5);
  });
});
