import type { GameModule, TableEvent, TableEventType } from "@casino-lord/core";
import { z } from "zod";

const baseEventSchema = z.object({
  type: z.string(),
});

const PLAYER_OWNED: ReadonlySet<TableEventType> = new Set([
  "BET_PLACED",
  "BET_UPDATED",
  "BET_REMOVED",
  "PLAYER_ACTION",
]);

const DEALER_FORBIDDEN: ReadonlySet<TableEventType> = new Set(["BET_PLACED", "PLAYER_JOINED"]);

export interface ValidationResult {
  ok: true;
  event: Omit<TableEvent, "seq" | "at">;
}

export interface ValidationError {
  ok: false;
  reason: string;
  ownershipViolation?: boolean;
}

export function validateSoloPlayerEvent(
  raw: Record<string, unknown> & { type: string },
  module: GameModule<unknown, unknown, unknown, unknown>,
  playerId: string,
): ValidationResult | ValidationError {
  const parsed = baseEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "invalid event envelope" };
  }

  const type = raw.type as TableEventType;

  if (!PLAYER_OWNED.has(type) && type !== "PLAYER_UPDATED") {
    return { ok: false, reason: `player cannot emit ${type}`, ownershipViolation: true };
  }

  if (type === "PLAYER_UPDATED") {
    const targetId = (raw as { playerId?: string }).playerId;
    if (targetId !== playerId) {
      return { ok: false, reason: "cannot update another player", ownershipViolation: true };
    }
    const patch = (raw as { patch?: Record<string, unknown> }).patch ?? {};
    const allowed = new Set(["name", "color"]);
    for (const key of Object.keys(patch)) {
      if (!allowed.has(key)) {
        return { ok: false, reason: `player cannot patch ${key}`, ownershipViolation: true };
      }
    }
  }

  if (type === "PLAYER_ACTION") {
    const targetId = (raw as { playerId?: string }).playerId;
    if (targetId !== playerId) {
      return { ok: false, reason: "cannot act for another player", ownershipViolation: true };
    }
  }

  if (type === "BET_PLACED") {
    const bet = (raw as { bet?: { playerId?: string } }).bet;
    if (bet?.playerId !== playerId) {
      return { ok: false, reason: "bet playerId mismatch", ownershipViolation: true };
    }
  }

  if (type === "RESULT_RECORDED" || type === "RESULT_EDITED") {
    const result = (raw as { result?: { data?: unknown } }).result;
    if (!result?.data) {
      return { ok: false, reason: "missing result payload" };
    }
    const check = module.resultSchema.safeParse(result.data);
    if (!check.success) {
      return { ok: false, reason: "invalid result payload" };
    }
  }

  if (type === "LIVE_INPUT") {
    const payload = (raw as { payload?: unknown }).payload;
    const check = module.liveInputSchema.safeParse(payload);
    if (!check.success) {
      return { ok: false, reason: "invalid live input payload" };
    }
  }

  void DEALER_FORBIDDEN;
  return { ok: true, event: raw as Omit<TableEvent, "seq" | "at"> };
}
