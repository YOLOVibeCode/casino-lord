import type { GameId, Participation } from "./types.js";
import type { PlacedBet, Player, ResultEnvelope } from "./data-model.js";
import type { TableSettings } from "./settings.js";

export interface TableEventEnvelope {
  seq: number;
  at: string;
}

export type TableEventType =
  | "TABLE_CREATED"
  | "SETTINGS_CHANGED"
  | "PARTICIPATION_CHANGED"
  | "SERIES_STARTED"
  | "SERIES_ENDED"
  | "SESSION_ENDED"
  | "DEALER_CHANGED"
  | "LIVE_INPUT"
  | "RESULT_RECORDED"
  | "RESULT_UNDONE"
  | "RESULT_EDITED"
  | "RESULT_DELETED"
  | "ANIMATION_PREVIEW"
  | "PLAYER_JOINED"
  | "PLAYER_UPDATED"
  | "PLAYER_REMOVED"
  | "BANK_ISSUED"
  | "BANK_ADJUSTED"
  | "BETS_OPENED"
  | "BET_PLACED"
  | "BET_UPDATED"
  | "BET_REMOVED"
  | "BETS_CLOSED"
  | "TURN_ASSIGNED"
  | "PLAYER_ACTION";

export type TableEvent = TableEventEnvelope &
  (
    | { type: "TABLE_CREATED"; game: GameId; participation: Participation; settings: TableSettings }
    | { type: "SETTINGS_CHANGED"; patch: Partial<TableSettings> }
    | { type: "PARTICIPATION_CHANGED"; participation: Participation }
    | { type: "SERIES_STARTED"; seriesId: string; label?: string; auto?: boolean; commit?: string }
    | { type: "SERIES_ENDED"; seriesId: string; seed?: string }
    | { type: "SESSION_ENDED" }
    | { type: "DEALER_CHANGED" }
    | { type: "LIVE_INPUT"; payload: unknown; source: "dealer" | "system" }
    | { type: "RESULT_RECORDED"; result: ResultEnvelope<unknown> }
    | { type: "RESULT_UNDONE"; resultId: string }
    | { type: "RESULT_EDITED"; result: ResultEnvelope<unknown> }
    | { type: "RESULT_DELETED"; resultId: string }
    | { type: "ANIMATION_PREVIEW"; eventId: string }
    | { type: "PLAYER_JOINED"; player: Player }
    | {
        type: "PLAYER_UPDATED";
        playerId: string;
        patch: Partial<Pick<Player, "name" | "color" | "seat" | "status">>;
      }
    | { type: "PLAYER_REMOVED"; playerId: string; reason?: string }
    | {
        type: "BANK_ISSUED";
        playerId: string;
        amount: number;
        reason: "buyin" | "rebuy" | "bonus" | "correction";
      }
    | { type: "BANK_ADJUSTED"; playerId: string; delta: number; reason: string }
    | { type: "BETS_OPENED"; roundId: string; closesAt?: string }
    | { type: "BET_PLACED"; bet: PlacedBet }
    | {
        type: "BET_UPDATED";
        betId: string;
        patch: Partial<Pick<PlacedBet, "amount" | "working">>;
      }
    | { type: "BET_REMOVED"; betId: string }
    | { type: "BETS_CLOSED"; roundId: string; by: "dealer" | "timer" | "auto" }
    | {
        type: "TURN_ASSIGNED";
        playerId: string | null;
        role: "shooter" | "seat";
        auto?: boolean;
      }
    | { type: "PLAYER_ACTION"; playerId: string; action: unknown; intent?: boolean }
  );

const EPHEMERAL: ReadonlySet<TableEventType> = new Set(["LIVE_INPUT", "ANIMATION_PREVIEW"]);

export function isPersistedEvent(event: TableEvent): boolean {
  return !EPHEMERAL.has(event.type);
}

export function isResultMutationEvent(
  event: TableEvent,
): event is Extract<TableEvent, { type: "RESULT_EDITED" | "RESULT_DELETED" }> {
  return event.type === "RESULT_EDITED" || event.type === "RESULT_DELETED";
}
