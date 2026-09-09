import type { TableEvent } from "@casino-lord/core";
import type { BaccaratRules } from "./rules.js";
import {
  initialState,
  rebuildDerived,
  type BaccaratResultEntry,
  type BaccaratState,
} from "./state.js";
import type { BaccaratLiveInput, BaccaratResult, Card, SlotId } from "./types.js";

function isBaccaratResult(data: unknown): data is BaccaratResult {
  return (
    typeof data === "object" &&
    data !== null &&
    "outcome" in data &&
    typeof (data as BaccaratResult).outcome === "string"
  );
}

function isBaccaratLiveInput(payload: unknown): payload is BaccaratLiveInput {
  return typeof payload === "object" && payload !== null && "slots" in payload;
}

function withDerived(
  results: BaccaratResultEntry[],
  liveSlots: Partial<Record<SlotId, Card>>,
  rules: BaccaratRules,
): BaccaratState {
  const base = { results, liveSlots };
  return { ...base, ...rebuildDerived(base, rules) };
}

export function reduce(
  state: BaccaratState,
  event: TableEvent,
  rules: BaccaratRules,
): BaccaratState {
  switch (event.type) {
    case "SERIES_STARTED":
    case "SERIES_ENDED":
      return initialState(rules);

    case "LIVE_INPUT": {
      if (!isBaccaratLiveInput(event.payload)) return state;
      const liveSlots = { ...state.liveSlots, ...event.payload.slots };
      return withDerived(state.results, liveSlots, rules);
    }

    case "RESULT_RECORDED": {
      if (!isBaccaratResult(event.result.data)) return state;
      const results = [...state.results, { id: event.result.id, data: event.result.data }];
      return withDerived(results, {}, rules);
    }

    case "RESULT_UNDONE":
    case "RESULT_DELETED": {
      const results = state.results.filter((r) => r.id !== event.resultId);
      return withDerived(results, state.liveSlots, rules);
    }

    case "RESULT_EDITED": {
      if (!isBaccaratResult(event.result.data)) return state;
      const data = event.result.data;
      const idx = state.results.findIndex((r) => r.id === event.result.id);
      if (idx < 0) return state;
      const results = state.results.map((r, i) => (i === idx ? { id: event.result.id, data } : r));
      return withDerived(results, state.liveSlots, rules);
    }

    default:
      return state;
  }
}
