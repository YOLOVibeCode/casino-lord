import { describe, expect, it } from "vitest";
import { dealerMustDraw, validateDealerPlay } from "./engine.js";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";
import type { Card } from "./types.js";

function c(rank: Card["rank"], suit: Card["suit"] = "S"): Card {
  return { rank, suit };
}

describe("dealer play validation S17/H17", () => {
  const s17 = { ...DEFAULT_BLACKJACK_RULES, dealerSoft17: "stand" as const };
  const h17 = { ...DEFAULT_BLACKJACK_RULES, dealerSoft17: "hit" as const };

  for (let total = 12; total <= 21; total++) {
    it(`S17 hard ${total}`, () => {
      const cards =
        total === 21
          ? [c("K"), c("A")]
          : total === 20
            ? [c("K"), c("Q")]
            : [c("10"), c(String(total - 10) as Card["rank"])].filter(
                (x) => x.rank !== "10" || total !== 20,
              );
      if (total < 20 && total > 11) {
        const hard = [c("10"), c(String(total - 10) as Card["rank"])];
        const v = validateDealerPlay(hard, s17);
        if (total <= 16) expect(v.dealerStatus).toBe("must_draw");
        else expect(v.dealerStatus).toBe("stands");
      }
    });
  }

  it("S17 stands on soft 17", () => {
    const cards = [c("A"), c("6")];
    expect(validateDealerPlay(cards, s17).dealerStatus).toBe("stands");
    expect(validateDealerPlay([...cards, c("4")], s17).illegalActions.length).toBeGreaterThan(0);
  });

  it("H17 hits soft 17", () => {
    const cards = [c("A"), c("6")];
    expect(validateDealerPlay(cards, h17).dealerStatus).toBe("must_draw");
  });

  it("flags hit on hard 17+", () => {
    const cards = [c("10"), c("7"), c("2")];
    const v = validateDealerPlay(cards, s17);
    expect(v.illegalActions.some((a) => a.includes("17"))).toBe(true);
  });

  it("dealerMustDraw matrix", () => {
    expect(dealerMustDraw(16, false, s17)).toBe(true);
    expect(dealerMustDraw(17, false, s17)).toBe(false);
    expect(dealerMustDraw(17, true, s17)).toBe(false);
    expect(dealerMustDraw(17, true, h17)).toBe(true);
  });
});
