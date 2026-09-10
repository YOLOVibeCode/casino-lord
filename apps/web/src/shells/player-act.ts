import { getRoundSettlements, type ComposedState, type GameId } from "@casino-lord/core";
import type { TableStore } from "../table/store.js";

const BLACKJACK_ACTIONS = new Set(["hit", "stand", "double", "split", "surrender"]);

type CrapsActionKind = "roll" | "toggle_working" | "press" | "take_down" | "pass_dice";

interface CrapsAction {
  kind: CrapsActionKind;
  betId?: string;
}

function isCrapsAction(action: unknown): action is CrapsAction {
  if (typeof action !== "object" || action === null || !("kind" in action)) return false;
  const kind = (action as { kind: unknown }).kind;
  return (
    kind === "roll" ||
    kind === "toggle_working" ||
    kind === "press" ||
    kind === "take_down" ||
    kind === "pass_dice"
  );
}

function isBlackjackAction(action: unknown): action is string {
  return typeof action === "string" && BLACKJACK_ACTIONS.has(action);
}

function lastWinningProfit(composed: ComposedState<unknown>, betId: string): number {
  let profit = 0;
  for (const round of composed.platform.rounds) {
    for (const settlement of getRoundSettlements(composed.platform, round.id)) {
      if (settlement.betId === betId && settlement.profit > profit) {
        profit = settlement.profit;
      }
    }
  }
  return profit;
}

export interface RoutePlayerActInput {
  game: GameId;
  action: unknown;
  playerId: string;
  virtualTable: boolean;
  isMyTurn: boolean;
  store: TableStore;
  composed: ComposedState<unknown>;
  emit: TableStore["emit"];
}

export function routePlayerAct({
  game,
  action,
  playerId,
  virtualTable,
  isMyTurn,
  store,
  composed,
  emit,
}: RoutePlayerActInput): void {
  if (game === "craps" && isCrapsAction(action)) {
    switch (action.kind) {
      case "roll":
        if (virtualTable && isMyTurn) {
          store.sendVirtual("trigger");
        }
        return;
      case "toggle_working": {
        if (!action.betId) return;
        const bet = composed.platform.bets.find((b) => b.id === action.betId);
        if (!bet) return;
        void emit({
          type: "BET_UPDATED",
          betId: action.betId,
          patch: { working: !bet.working },
        });
        return;
      }
      case "press": {
        if (!action.betId) return;
        const bet = composed.platform.bets.find((b) => b.id === action.betId);
        if (!bet) return;
        const profit = lastWinningProfit(composed, action.betId);
        if (profit <= 0) return;
        void emit({
          type: "BET_UPDATED",
          betId: action.betId,
          patch: { amount: bet.amount + profit },
        });
        return;
      }
      case "take_down":
        if (!action.betId) return;
        void emit({ type: "BET_REMOVED", betId: action.betId });
        return;
      case "pass_dice":
        void emit({ type: "PLAYER_ACTION", playerId, action });
        return;
    }
  }

  if (game === "blackjack" && isBlackjackAction(action)) {
    if (virtualTable) {
      store.sendVirtual("action", { playerId, action });
    } else {
      void emit({ type: "PLAYER_ACTION", playerId, action, intent: true });
    }
    return;
  }

  void emit({ type: "PLAYER_ACTION", playerId, action });
}
