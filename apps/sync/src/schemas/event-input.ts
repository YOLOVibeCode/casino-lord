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

function validatePlayerUpdatedPatch(
  patch: Record<string, unknown>,
  module: GameModule<unknown, unknown, unknown, unknown>,
): ValidationError | null {
  for (const key of Object.keys(patch)) {
    if (key === "name" || key === "color") {
      continue;
    }
    if (key === "status") {
      const value = patch.status;
      if (value !== "away" && value !== "active") {
        return { ok: false, reason: "player cannot patch status", ownershipViolation: true };
      }
      continue;
    }
    if (key === "seat") {
      const value = patch.seat;
      if (
        module.seats?.assign !== "player" ||
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value <= 0
      ) {
        return { ok: false, reason: "player cannot patch seat", ownershipViolation: true };
      }
      continue;
    }
    return { ok: false, reason: `player cannot patch ${key}`, ownershipViolation: true };
  }
  return null;
}

export interface ValidationResult {
  ok: true;
  event: Omit<TableEvent, "seq" | "at">;
}

export interface ValidationError {
  ok: false;
  reason: string;
  ownershipViolation?: boolean;
}

export function validateInboundEvent(
  raw: Record<string, unknown> & { type: string },
  role: "dealer" | "display" | "player",
  module: GameModule<unknown, unknown, unknown, unknown>,
  playerId?: string,
): ValidationResult | ValidationError {
  const parsed = baseEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "invalid event envelope" };
  }

  const type = raw.type as TableEventType;

  if (role === "display") {
    return { ok: false, reason: "display cannot emit events", ownershipViolation: true };
  }

  if (role === "dealer" && DEALER_FORBIDDEN.has(type)) {
    return { ok: false, reason: `dealer cannot emit ${type}`, ownershipViolation: true };
  }

  if (role === "dealer" && type === "BET_REMOVED" && raw.by !== "dealer") {
    return {
      ok: false,
      reason: "dealer must void bets with by: dealer",
      ownershipViolation: true,
    };
  }

  if (role === "player") {
    if (!playerId) {
      return { ok: false, reason: "player not identified", ownershipViolation: true };
    }
    if (!PLAYER_OWNED.has(type) && type !== "PLAYER_UPDATED") {
      return { ok: false, reason: `player cannot emit ${type}`, ownershipViolation: true };
    }
    if (type === "PLAYER_UPDATED") {
      const targetId = (raw as { playerId?: string }).playerId;
      if (targetId !== playerId) {
        return { ok: false, reason: "cannot update another player", ownershipViolation: true };
      }
      const patch = (raw as { patch?: Record<string, unknown> }).patch ?? {};
      const patchError = validatePlayerUpdatedPatch(patch, module);
      if (patchError) {
        return patchError;
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
    if (type === "BET_REMOVED" && raw.by === "dealer") {
      return {
        ok: false,
        reason: "player cannot void bets as dealer",
        ownershipViolation: true,
      };
    }
    if (type === "BET_UPDATED" || type === "BET_REMOVED") {
      // Ownership of bet updates is validated at reducer; player may emit for own bets only.
      // Full bet ownership check requires state; allow emit and let reducer no-op if wrong bet.
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

  return { ok: true, event: raw as Omit<TableEvent, "seq" | "at"> };
}

export const createTableBodySchema = z.object({
  game: z.enum(["baccarat", "roulette", "craps", "blackjack"]),
  participation: z.object({
    playerMode: z.enum(["off", "on"]),
    bank: z.enum(["none", "house"]),
    outcomeSource: z.enum(["physical", "virtual"]),
  }),
  settings: z.record(z.unknown()).optional(),
});

export const joinPlayerBodySchema = z.object({
  name: z.string(),
  color: z.string(),
});
