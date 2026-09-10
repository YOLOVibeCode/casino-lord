import { describe, expect, it } from "vitest";
import { baccaratModule, DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import type { BaccaratRules } from "@casino-lord/game-baccarat";
import type { BetDef, PlacedBet } from "@casino-lord/core";
import { computeAllBetRows, computeBetRow, formatPays } from "./payout-calculator.js";

function findBet(id: string): BetDef<BaccaratRules, unknown> {
  for (const group of baccaratModule.bets.groups) {
    const bet = group.bets.find((b) => b.id === id);
    if (bet) return bet;
  }
  throw new Error(`bet ${id} not found`);
}

describe("payout calculator", () => {
  it("formats pays ratio", () => {
    expect(formatPays({ num: 8, den: 1 })).toBe("8:1");
    expect(formatPays({ num: 1, den: 1 })).toBe("1:1");
  });

  it("computes default baccarat payouts for amount 100", () => {
    const rules = DEFAULT_BACCARAT_RULES;
    const amount = 100;

    const player = computeBetRow(findBet("player"), amount, rules, "down")!;
    expect(player.pays).toBe("1:1");
    expect(player.profit).toBe(100);
    expect(player.returned).toBe(200);

    const banker = computeBetRow(findBet("banker"), amount, rules, "down")!;
    expect(banker.pays).toBe("1:1");
    expect(banker.note).toBe("5% commission");
    expect(banker.profit).toBe(95);
    expect(banker.returned).toBe(195);

    const tie = computeBetRow(findBet("tie"), amount, rules, "down")!;
    expect(tie.pays).toBe("8:1");
    expect(tie.profit).toBe(800);
    expect(tie.returned).toBe(900);

    const playerPair = computeBetRow(findBet("player_pair"), amount, rules, "down")!;
    expect(playerPair.pays).toBe("11:1");
    expect(playerPair.profit).toBe(1100);
    expect(playerPair.returned).toBe(1200);
  });

  it("shows 1:2 on 6 note when banker commission is 0", () => {
    const rules: BaccaratRules = { ...DEFAULT_BACCARAT_RULES, bankerCommission: 0 };
    const banker = computeBetRow(findBet("banker"), 100, rules, "down")!;
    expect(banker.note).toBe("1:2 on 6");
    expect(banker.profit).toBe(100);
  });

  it("renders all catalogue bets", () => {
    const rows = computeAllBetRows(baccaratModule.bets.groups, 100, DEFAULT_BACCARAT_RULES, "down");
    expect(rows).toHaveLength(5);
  });

  it("banker preview profit matches settle on banker win for stake 5", () => {
    const amount = 5;
    const preview = computeBetRow(findBet("banker"), amount, DEFAULT_BACCARAT_RULES, "down")!;
    const bet: PlacedBet<"banker"> = {
      id: "b1",
      playerId: "p1",
      roundId: "r1",
      type: "banker",
      amount,
      declared: false,
      working: false,
      placedAt: "2026-01-01T00:00:00.000Z",
      originRoundId: "r1",
    };
    const settlements = baccaratModule.settle({
      bets: [bet],
      result: {
        cards: null,
        outcome: "B",
        playerTotal: 7,
        bankerTotal: 9,
      },
      rules: DEFAULT_BACCARAT_RULES,
      state: baccaratModule.initialState(),
    });
    expect(preview.profit).toBe(4);
    expect(settlements[0]?.profit).toBe(preview.profit);
  });
});
