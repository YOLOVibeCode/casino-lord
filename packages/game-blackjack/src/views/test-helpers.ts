import type { TableMeta } from "@casino-lord/core";
import { reduce } from "../reducer.js";
import { DEFAULT_BLACKJACK_RULES, type BlackjackRules } from "../rules.js";
import { initialState, type BlackjackState } from "../state.js";
import type { BlackjackLiveInput, BlackjackResult } from "../types.js";

export const TABLE_META: TableMeta = {
  code: "TEST01",
  game: "blackjack",
  seriesNumber: 1,
  resultIndex: 0,
  participation: { playerMode: "off", bank: "none", outcomeSource: "physical" },
  playerCount: 0,
};

export function stateWithLiveInput(
  live: BlackjackLiveInput,
  rules: BlackjackRules = DEFAULT_BLACKJACK_RULES,
): BlackjackState {
  let state = initialState(rules);
  state = reduce(
    state,
    {
      seq: 1,
      at: "2026-01-01T00:00:01.000Z",
      type: "LIVE_INPUT",
      payload: live,
      source: "dealer",
    },
    rules,
  );
  return state;
}

export function stateWithResult(
  result: BlackjackResult,
  rules: BlackjackRules = DEFAULT_BLACKJACK_RULES,
): BlackjackState {
  let state = initialState(rules);
  state = reduce(
    state,
    {
      seq: 1,
      at: "2026-01-01T00:00:01.000Z",
      type: "RESULT_RECORDED",
      result: {
        id: "r1",
        index: 0,
        recordedAt: "2026-01-01T00:00:01.000Z",
        quick: result.depth === "quick",
        source: "physical",
        by: "dealer",
        data: result,
      },
    },
    rules,
  );
  return state;
}
