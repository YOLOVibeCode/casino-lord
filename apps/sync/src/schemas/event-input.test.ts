import type { GameModule } from "@casino-lord/core";
import { describe, expect, it } from "vitest";
import { getModule } from "../modules.js";
import { validateInboundEvent } from "./event-input.js";

const PLAYER_ID = "p1";

function playerUpdated(
  patch: Record<string, unknown>,
  playerId = PLAYER_ID,
): Record<string, unknown> & { type: string } {
  return { type: "PLAYER_UPDATED", playerId, patch };
}

function validatePlayerPatch(
  patch: Record<string, unknown>,
  module: GameModule<unknown, unknown, unknown, unknown>,
) {
  return validateInboundEvent(playerUpdated(patch), "player", module, PLAYER_ID);
}

describe("validateInboundEvent PLAYER_UPDATED player patch", () => {
  const blackjack = getModule("blackjack")!;
  const baccarat = getModule("baccarat")!;
  const dealerAssignModule = {
    seats: { max: 7, assign: "dealer" },
  } as GameModule<unknown, unknown, unknown, unknown>;

  it("accepts status away", () => {
    const result = validatePlayerPatch({ status: "away" }, blackjack);
    expect(result.ok).toBe(true);
  });

  it("accepts status active", () => {
    const result = validatePlayerPatch({ status: "active" }, blackjack);
    expect(result.ok).toBe(true);
  });

  it("rejects status removed", () => {
    const result = validatePlayerPatch({ status: "removed" }, blackjack);
    expect(result).toEqual({
      ok: false,
      reason: "player cannot patch status",
      ownershipViolation: true,
    });
  });

  it("accepts seat for player-assign module", () => {
    const result = validatePlayerPatch({ seat: 3 }, blackjack);
    expect(result.ok).toBe(true);
  });

  it("rejects seat for baccarat", () => {
    const result = validatePlayerPatch({ seat: 3 }, baccarat);
    expect(result).toEqual({
      ok: false,
      reason: "player cannot patch seat",
      ownershipViolation: true,
    });
  });

  it("rejects seat for dealer-assign module", () => {
    const result = validatePlayerPatch({ seat: 3 }, dealerAssignModule);
    expect(result).toEqual({
      ok: false,
      reason: "player cannot patch seat",
      ownershipViolation: true,
    });
  });

  it("still accepts name and color", () => {
    const result = validatePlayerPatch({ name: "X", color: "#fff" }, blackjack);
    expect(result.ok).toBe(true);
  });
});

describe("validateInboundEvent BET_REMOVED by", () => {
  const baccarat = getModule("baccarat")!;

  function betRemoved(by?: string): Record<string, unknown> & { type: string } {
    return by === undefined
      ? { type: "BET_REMOVED", betId: "b1" }
      : { type: "BET_REMOVED", betId: "b1", by };
  }

  it("accepts dealer void with by: dealer", () => {
    const result = validateInboundEvent(betRemoved("dealer"), "dealer", baccarat);
    expect(result.ok).toBe(true);
  });

  it("rejects dealer BET_REMOVED without by", () => {
    const result = validateInboundEvent(betRemoved(), "dealer", baccarat);
    expect(result).toEqual({
      ok: false,
      reason: "dealer must void bets with by: dealer",
      ownershipViolation: true,
    });
  });

  it("rejects dealer BET_REMOVED with by: player", () => {
    const result = validateInboundEvent(betRemoved("player"), "dealer", baccarat);
    expect(result).toEqual({
      ok: false,
      reason: "dealer must void bets with by: dealer",
      ownershipViolation: true,
    });
  });

  it("accepts player BET_REMOVED without by", () => {
    const result = validateInboundEvent(betRemoved(), "player", baccarat, PLAYER_ID);
    expect(result.ok).toBe(true);
  });

  it("accepts player BET_REMOVED with by: player", () => {
    const result = validateInboundEvent(betRemoved("player"), "player", baccarat, PLAYER_ID);
    expect(result.ok).toBe(true);
  });

  it("rejects player BET_REMOVED with by: dealer", () => {
    const result = validateInboundEvent(betRemoved("dealer"), "player", baccarat, PLAYER_ID);
    expect(result).toEqual({
      ok: false,
      reason: "player cannot void bets as dealer",
      ownershipViolation: true,
    });
  });
});
