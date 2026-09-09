import { reduce } from "../reducer.js";
import { DEFAULT_CRAPS_RULES, type CrapsRules } from "../rules.js";
import { normalizeResult } from "../engine.js";
import { initialState } from "../state.js";
import type { CrapsState } from "../types.js";
import type { Face } from "../types.js";
import { importText } from "../serialize.js";

function ev(seq: number, body: Record<string, unknown> & { type: string }) {
  return {
    seq,
    at: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
    ...body,
  } as Parameters<typeof reduce>[1];
}

export function stateWithRollTokens(
  tokens: string,
  rules: CrapsRules = DEFAULT_CRAPS_RULES,
): CrapsState {
  let state = initialState(rules);
  state = reduce(state, ev(1, { type: "SERIES_STARTED", seriesId: "s1" }), rules);

  const imported = importText(tokens, rules);
  if (!imported.ok) {
    throw new Error(imported.errors.join("; "));
  }

  let seq = 1;
  for (const result of imported.results) {
    seq++;
    state = reduce(
      state,
      ev(seq, {
        type: "RESULT_RECORDED",
        result: {
          id: `r${seq}`,
          index: seq - 2,
          recordedAt: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
          quick: result.a === null && result.b === null,
          source: "physical",
          by: "dealer",
          data: result,
        },
      }),
      rules,
    );
  }
  return state;
}

export function stateWithRoll(
  a: Face,
  b: Face,
  rules: CrapsRules = DEFAULT_CRAPS_RULES,
): CrapsState {
  return stateWithRollTokens(`${a}-${b}`, rules);
}
