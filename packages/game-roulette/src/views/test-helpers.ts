import { reduce } from "../reducer.js";
import { DEFAULT_ROULETTE_RULES, type RouletteRules } from "../rules.js";
import { initialState, type RouletteState } from "../state.js";
import type { Pocket, RouletteResult } from "../types.js";
import { isValidPocket } from "../wheel.js";

function parsePocket(token: string): Pocket | null {
  if (token === "-") return null;
  if (token === "00") return "00";
  if (token === "0") return 0;
  const n = Number(token);
  if (Number.isInteger(n) && n >= 1 && n <= 36) return n;
  throw new Error(`Invalid pocket token: ${token}`);
}

export function stateWithSpins(
  body: string,
  rules: RouletteRules = DEFAULT_ROULETTE_RULES,
): RouletteState {
  let state = initialState(rules);
  let seq = 0;
  for (const token of body.split(/\s+/).filter(Boolean)) {
    const pocket = parsePocket(token);
    if (pocket !== null && !isValidPocket(pocket, rules)) continue;
    seq++;
    const data: RouletteResult = { pocket };
    state = reduce(
      state,
      {
        seq,
        at: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
        type: "RESULT_RECORDED",
        result: {
          id: `s${seq}`,
          index: seq - 1,
          recordedAt: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
          quick: false,
          source: "physical",
          by: "dealer",
          data,
        },
      },
      rules,
    );
  }
  return state;
}
