import type { PlacedBet, Settlement } from "@casino-lord/core";
import type { BaccaratBetId } from "./bet-target.js";
import type { BaccaratRules } from "./rules.js";
import type { BaccaratResult } from "./types.js";
import type { BaccaratState } from "./state.js";

export interface SettleInput {
  bets: PlacedBet<BaccaratBetId>[];
  result: BaccaratResult;
  before: BaccaratState;
  after: BaccaratState;
  rules: BaccaratRules;
}

function pushResult(stake: number): Settlement<BaccaratBetId> {
  return { betId: "", outcome: "push", returned: stake, profit: 0 };
}

function winResult(betId: string, stake: number, profit: number): Settlement<BaccaratBetId> {
  return { betId, outcome: "win", returned: stake + profit, profit };
}

function loseResult(betId: string, stake: number): Settlement<BaccaratBetId> {
  return { betId, outcome: "lose", returned: 0, profit: -stake };
}

function settleBet(
  bet: PlacedBet<BaccaratBetId>,
  result: BaccaratResult,
  rules: BaccaratRules,
): Settlement<BaccaratBetId> {
  const { amount, id: betId } = bet;
  const { outcome, playerPair, bankerPair, bankerTotal } = result;

  switch (bet.type) {
    case "player": {
      if (outcome === "P") return winResult(betId, amount, amount);
      if (outcome === "T") return { ...pushResult(amount), betId };
      return loseResult(betId, amount);
    }
    case "banker": {
      if (outcome === "T") return { ...pushResult(amount), betId };
      if (outcome === "P") return loseResult(betId, amount);
      let profit: number;
      if (rules.bankerCommission === 0 && bankerTotal === 6) {
        profit = Math.floor(amount * rules.noCommissionBanker6Payout);
      } else {
        profit = Math.floor(amount * (1 - rules.bankerCommission));
      }
      return winResult(betId, amount, profit);
    }
    case "tie": {
      if (outcome === "T") {
        const profit = amount * rules.tiePayout;
        return winResult(betId, amount, profit);
      }
      return loseResult(betId, amount);
    }
    case "player_pair": {
      if (playerPair) {
        const profit = amount * rules.pairPayout;
        return winResult(betId, amount, profit);
      }
      return loseResult(betId, amount);
    }
    case "banker_pair": {
      if (bankerPair) {
        const profit = amount * rules.pairPayout;
        return winResult(betId, amount, profit);
      }
      return loseResult(betId, amount);
    }
    default:
      return loseResult(betId, amount);
  }
}

export function settleBaccarat(input: SettleInput): Settlement<BaccaratBetId>[] {
  return input.bets.map((bet) => settleBet(bet, input.result, input.rules));
}
