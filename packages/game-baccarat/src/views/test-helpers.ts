import { buildRoads } from "../roads/index.js";
import { DEFAULT_BACCARAT_RULES, type BaccaratRules } from "../rules.js";
import { parseOutcomeToken } from "../quick-entry.js";
import { reduce } from "../reducer.js";
import { initialState, type BaccaratState } from "../state.js";
import type { RoadHand } from "../types.js";

export function handsFromTokens(tokens: string): RoadHand[] {
  return tokens.split(/\s+/).filter(Boolean).map(parseOutcomeToken);
}

export function stateWithRoadTokens(
  tokens: string,
  rules: BaccaratRules = DEFAULT_BACCARAT_RULES,
): BaccaratState {
  let state = initialState(rules);
  let seq = 0;
  for (const hand of handsFromTokens(tokens)) {
    seq++;
    state = reduce(
      state,
      {
        seq,
        at: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
        type: "RESULT_RECORDED",
        result: {
          id: `h${seq}`,
          index: seq - 1,
          recordedAt: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
          quick: true,
          source: "physical",
          by: "dealer",
          data: {
            cards: null,
            outcome: hand.outcome,
            playerTotal: null,
            bankerTotal: null,
            playerPair: hand.playerPair,
            bankerPair: hand.bankerPair,
            natural: false,
          },
        },
      },
      rules,
    );
  }
  return state;
}

export function roadsFromTokens(tokens: string, rules: BaccaratRules = DEFAULT_BACCARAT_RULES) {
  return buildRoads(handsFromTokens(tokens), rules);
}
