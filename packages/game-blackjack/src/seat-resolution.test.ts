import { describe, expect, it } from "vitest";
import { resolveHandOutcomes, resolveSeatOutcome } from "./engine.js";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";
import type { Card, HandInput } from "./types.js";

function c(rank: Card["rank"], suit: Card["suit"] = "H"): Card {
  return { rank, suit };
}

function hand(cards: Card[], opts: Partial<HandInput> = {}): HandInput {
  return {
    cards,
    doubled: false,
    fromSplit: false,
    surrendered: false,
    outcome: null,
    ...opts,
  };
}

describe("seat resolution", () => {
  const rules = DEFAULT_BLACKJACK_RULES;

  it("player wins vs dealer bust", () => {
    const outcome = resolveSeatOutcome(
      hand([c("10"), c("8")]),
      { total: 22, bust: true, blackjack: false },
      rules,
    );
    expect(outcome).toBe("win");
  });

  it("player blackjack beats dealer 20", () => {
    expect(
      resolveSeatOutcome(
        hand([c("A"), c("K")]),
        { total: 20, bust: false, blackjack: false },
        rules,
      ),
    ).toBe("blackjack");
  });

  it("both blackjack pushes", () => {
    expect(
      resolveSeatOutcome(
        hand([c("A"), c("K")]),
        { total: 21, bust: false, blackjack: true },
        rules,
      ),
    ).toBe("push");
  });

  it("dealer 17 beats player 16", () => {
    expect(
      resolveSeatOutcome(
        hand([c("10"), c("6")]),
        { total: 17, bust: false, blackjack: false },
        rules,
      ),
    ).toBe("lose");
  });

  it("peek vs ENHC dealer blackjack with doubled hand", () => {
    const doubled = hand([c("10"), c("8")], { doubled: true });
    const peekRules = { ...rules, peek: true };
    const enhcRules = { ...rules, peek: false };
    expect(
      resolveSeatOutcome(doubled, { total: 21, bust: false, blackjack: true }, peekRules),
    ).toBe("lose");
    expect(
      resolveSeatOutcome(doubled, { total: 21, bust: false, blackjack: true }, enhcRules),
    ).toBe("lose");
  });

  it("resolves full round hands", () => {
    const dealer = [c("10"), c("7")];
    const resolved = resolveHandOutcomes([hand([c("10"), c("9")])], dealer, rules);
    expect(resolved[0]!.outcome).toBe("win");
  });
});
