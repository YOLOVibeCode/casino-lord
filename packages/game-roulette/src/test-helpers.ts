import type { PlacedBet } from "@casino-lord/core";
import type { RouletteBetTarget } from "./bet-target.js";
import { initialState } from "./state.js";
import type { RouletteRules } from "./rules.js";
import type { RouletteResult } from "./types.js";
import { settleRoulette } from "./settle.js";

export function makeBet(
  type: string,
  amount: number,
  target?: RouletteBetTarget,
): PlacedBet<RouletteBetTarget> {
  return {
    id: `bet-${type}-${JSON.stringify(target ?? null)}`,
    playerId: "p1",
    roundId: "r1",
    type,
    ...(target !== undefined ? { target } : {}),
    amount,
    declared: false,
    working: false,
    placedAt: "2026-01-01T00:00:00.000Z",
    originRoundId: "r1",
  };
}

export function settleOne(
  type: string,
  amount: number,
  pocket: RouletteResult["pocket"],
  rules: RouletteRules,
  target?: RouletteBetTarget,
) {
  const before = initialState(rules);
  const result: RouletteResult = { pocket };
  const after = before;
  return settleRoulette({
    bets: [makeBet(type, amount, target)],
    result,
    before,
    after,
    rules,
  })[0]!;
}
