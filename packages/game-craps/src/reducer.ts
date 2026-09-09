import type { TableEvent } from "@casino-lord/core";
import { normalizeResult } from "./engine.js";
import type { CrapsRules } from "./rules.js";
import { initialState, rebuildFromResults, resetShooterScope, withLiveInput } from "./state.js";
import { assignShooter, passDice, rotateShooterAfterSevenOut } from "./shooter.js";
import type { CrapsLiveInput, CrapsResult, CrapsState } from "./types.js";

function isCrapsResult(data: unknown): data is CrapsResult {
  return (
    typeof data === "object" &&
    data !== null &&
    "total" in data &&
    typeof (data as CrapsResult).total === "number"
  );
}

function isCrapsLiveInput(payload: unknown): payload is CrapsLiveInput {
  return typeof payload === "object" && payload !== null && ("a" in payload || "b" in payload);
}

export function reduce(state: CrapsState, event: TableEvent, rules: CrapsRules): CrapsState {
  switch (event.type) {
    case "SERIES_STARTED": {
      let next = resetShooterScope(state, event.label);
      if (event.auto && state.shooterOrder.length > 0) {
        next = rotateShooterAfterSevenOut(next);
      }
      return next;
    }

    case "SERIES_ENDED":
      return initialState(rules);

    case "LIVE_INPUT": {
      if (!isCrapsLiveInput(event.payload)) return state;
      return withLiveInput(state, event.payload);
    }

    case "RESULT_RECORDED": {
      if (!isCrapsResult(event.result.data)) return state;
      const results = [
        ...state.results.map((r) => ({ id: r.id, data: r as CrapsResult })),
        { id: event.result.id, data: normalizeResult(event.result.data) },
      ];
      return rebuildFromResults(results, rules, {
        currentShooterId: state.currentShooterId,
        shooterOrder: state.shooterOrder,
        seriesLabel: state.seriesLabel,
        table: state.table,
      });
    }

    case "RESULT_UNDONE":
    case "RESULT_DELETED": {
      const results = state.results
        .filter((r) => r.id !== event.resultId)
        .map((r) => ({ id: r.id, data: r as CrapsResult }));
      return rebuildFromResults(results, rules, {
        currentShooterId: state.currentShooterId,
        shooterOrder: state.shooterOrder,
        seriesLabel: state.seriesLabel,
        table: state.table,
      });
    }

    case "RESULT_EDITED": {
      if (!isCrapsResult(event.result.data)) return state;
      const data = normalizeResult(event.result.data);
      const idx = state.results.findIndex((r) => r.id === event.result.id);
      if (idx < 0) return state;
      const results = state.results.map((r, i) =>
        i === idx ? { id: event.result.id, data } : { id: r.id, data: r as CrapsResult },
      );
      return rebuildFromResults(results, rules, {
        currentShooterId: state.currentShooterId,
        shooterOrder: state.shooterOrder,
        seriesLabel: state.seriesLabel,
        table: state.table,
      });
    }

    case "TURN_ASSIGNED":
      return assignShooter(state, event.playerId);

    case "PLAYER_JOINED": {
      if (state.shooterOrder.includes(event.player.id)) return state;
      return {
        ...state,
        shooterOrder: [...state.shooterOrder, event.player.id],
        currentShooterId: state.currentShooterId ?? event.player.id,
      };
    }

    case "PLAYER_REMOVED": {
      const shooterOrder = state.shooterOrder.filter((id) => id !== event.playerId);
      let currentShooterId = state.currentShooterId;
      if (currentShooterId === event.playerId) {
        currentShooterId = shooterOrder[0] ?? null;
      }
      return { ...state, shooterOrder, currentShooterId };
    }

    case "PLAYER_ACTION": {
      const action = event.action as { kind?: string } | undefined;
      if (action?.kind === "pass_dice") {
        return passDice(state);
      }
      return state;
    }

    case "SETTINGS_CHANGED":
      return state;

    default:
      return state;
  }
}
