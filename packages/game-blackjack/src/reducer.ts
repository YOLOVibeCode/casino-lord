import type { TableEvent } from "@casino-lord/core";
import type { BlackjackRules } from "./rules.js";
import {
  initialState,
  normalizeResult,
  rebuildDerived,
  type BlackjackState,
  type RoundRecord,
} from "./state.js";
import type { BlackjackLiveInput, BlackjackResult } from "./types.js";

function isBlackjackResult(data: unknown): data is BlackjackResult {
  return (
    typeof data === "object" &&
    data !== null &&
    "dealer" in data &&
    "depth" in data &&
    typeof (data as BlackjackResult).depth === "string"
  );
}

function isBlackjackLiveInput(payload: unknown): payload is BlackjackLiveInput {
  return typeof payload === "object" && payload !== null && "dealer" in payload;
}

function withDerived(
  rounds: RoundRecord[],
  liveInput: BlackjackLiveInput,
  rules: BlackjackRules,
): BlackjackState {
  const base = { rounds, liveInput };
  return { ...base, ...rebuildDerived(base, rules) };
}

export function reduce(
  state: BlackjackState,
  event: TableEvent,
  rules: BlackjackRules,
): BlackjackState {
  switch (event.type) {
    case "SERIES_STARTED":
    case "SERIES_ENDED":
      return initialState(rules);

    case "LIVE_INPUT": {
      if (!isBlackjackLiveInput(event.payload)) return state;
      const liveInput: BlackjackLiveInput = {
        dealer: event.payload.dealer.length > 0 ? event.payload.dealer : state.liveInput.dealer,
        seats:
          Object.keys(event.payload.seats).length > 0 ? event.payload.seats : state.liveInput.seats,
      };
      const recordDespite =
        event.payload.recordDespiteDealerError ?? state.liveInput.recordDespiteDealerError;
      if (recordDespite !== undefined) liveInput.recordDespiteDealerError = recordDespite;
      const virtual = event.payload.virtual ?? state.liveInput.virtual;
      if (virtual !== undefined) liveInput.virtual = virtual;
      return withDerived(state.rounds, liveInput, rules);
    }

    case "RESULT_RECORDED": {
      if (!isBlackjackResult(event.result.data)) return state;
      const data = normalizeResult(event.result.data, rules);
      const rounds = [...state.rounds, { id: event.result.id, data }];
      return withDerived(rounds, { dealer: [], seats: {} }, rules);
    }

    case "RESULT_UNDONE":
    case "RESULT_DELETED": {
      const rounds = state.rounds.filter((r) => r.id !== event.resultId);
      return withDerived(rounds, state.liveInput, rules);
    }

    case "RESULT_EDITED": {
      if (!isBlackjackResult(event.result.data)) return state;
      const data = normalizeResult(event.result.data, rules);
      const idx = state.rounds.findIndex((r) => r.id === event.result.id);
      if (idx < 0) return state;
      const rounds = state.rounds.map((r, i) => (i === idx ? { id: event.result.id, data } : r));
      return withDerived(rounds, state.liveInput, rules);
    }

    default:
      return state;
  }
}
