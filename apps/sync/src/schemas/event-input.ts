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

export function validateInboundEvent(
  raw: Record<string, unknown> & { type: string },
  role: "dealer" | "display" | "player",
  module: GameModule<unknown, unknown, unknown, unknown>,
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

  if (role === "player" && !PLAYER_OWNED.has(type) && type !== "PLAYER_UPDATED") {
    return { ok: false, reason: `player cannot emit ${type}`, ownershipViolation: true };
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
