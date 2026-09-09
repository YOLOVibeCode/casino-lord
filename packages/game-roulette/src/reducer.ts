import type { TableEvent } from "@casino-lord/core";
import { initialState, rebuildDerived, type RouletteState, type SpinEntry } from "./state.js";
import type { RouletteRules } from "./rules.js";
import type { RouletteLiveInput, RouletteResult } from "./types.js";
import { isValidPocket } from "./wheel.js";

function isRouletteResult(data: unknown): data is RouletteResult {
  return typeof data === "object" && data !== null && "pocket" in data;
}

function isRouletteLiveInput(payload: unknown): payload is RouletteLiveInput {
  return typeof payload === "object" && payload !== null && "pending" in payload;
}

function withDerived(
  spins: SpinEntry[],
  livePending: Pocket | null,
  rules: RouletteRules,
): RouletteState {
  return { spins, livePending, ...rebuildDerived(spins, livePending, rules) };
}

type Pocket = import("./types.js").Pocket;

function validateResult(data: RouletteResult, rules: RouletteRules): boolean {
  if (data.pocket === null) return true;
  return isValidPocket(data.pocket, rules);
}

export function reduce(
  state: RouletteState,
  event: TableEvent,
  rules: RouletteRules,
): RouletteState {
  switch (event.type) {
    case "SERIES_STARTED":
    case "SERIES_ENDED":
      return initialState(rules);

    case "LIVE_INPUT": {
      if (!isRouletteLiveInput(event.payload)) return state;
      const pending = event.payload.pending;
      if (pending !== null && !isValidPocket(pending, rules)) return state;
      return withDerived(state.spins, pending, rules);
    }

    case "RESULT_RECORDED": {
      if (!isRouletteResult(event.result.data)) return state;
      if (!validateResult(event.result.data, rules)) return state;
      const spins: SpinEntry[] = [...state.spins, { id: event.result.id, data: event.result.data }];
      return withDerived(spins, null, rules);
    }

    case "RESULT_UNDONE":
    case "RESULT_DELETED": {
      const spins = state.spins.filter((s) => s.id !== event.resultId);
      return withDerived(spins, state.livePending, rules);
    }

    case "RESULT_EDITED": {
      if (!isRouletteResult(event.result.data)) return state;
      const edited: RouletteResult = event.result.data;
      if (!validateResult(edited, rules)) return state;
      const idx = state.spins.findIndex((s) => s.id === event.result.id);
      if (idx < 0) return state;
      const spins = state.spins.map((s, i) =>
        i === idx ? { id: event.result.id, data: edited } : s,
      );
      return withDerived(spins, state.livePending, rules);
    }

    default:
      return state;
  }
}
