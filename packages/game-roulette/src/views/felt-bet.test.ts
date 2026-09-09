import { describe, expect, it } from "vitest";
import { ROULETTE_BET_IDS } from "../bet-target.js";
import { DEFAULT_ROULETTE_RULES } from "../rules.js";
import { betTargetSchema } from "../schemas.js";
import {
  betPayloadFromZone,
  enumerateFeltZones,
  isZoneAllowed,
  targetFromZoneId,
  zoneIdForTarget,
} from "./felt-bet.js";

const AMERICAN_RULES = { ...DEFAULT_ROULETTE_RULES, wheel: "american" as const };

const CTX = {
  playerId: "p1",
  roundId: "r1",
  amount: 100,
  declared: false,
  originRoundId: "r1",
};

describe("felt-bet helpers", () => {
  it("enumerates every catalogue bet id with valid targets", () => {
    const euZones = enumerateFeltZones(DEFAULT_ROULETTE_RULES);
    const kinds = new Set(euZones.map((z) => z.type));
    for (const id of ROULETTE_BET_IDS) {
      if (id === "top_line") continue;
      expect(kinds.has(id)).toBe(true);
    }

    const usZones = enumerateFeltZones(AMERICAN_RULES);
    const usKinds = new Set(usZones.map((z) => z.type));
    expect(usKinds.has("top_line")).toBe(true);
    expect(usKinds.has("basket")).toBe(false);
    expect(usKinds.has("voisins")).toBe(false);
  });

  it("round-trips zone ids for representative targets", () => {
    const samples = enumerateFeltZones(DEFAULT_ROULETTE_RULES).slice(0, 20);
    for (const zone of samples) {
      const parsed = targetFromZoneId(zone.zoneId, DEFAULT_ROULETTE_RULES);
      expect(parsed).not.toBeNull();
      expect(zoneIdForTarget(zone.type, parsed!)).toBe(zone.zoneId);
    }
  });

  it("emits PlacedBet payloads that validate against betTargetSchema", () => {
    for (const zone of enumerateFeltZones(DEFAULT_ROULETTE_RULES)) {
      const payload = betPayloadFromZone(zone.zoneId, CTX, DEFAULT_ROULETTE_RULES);
      expect(payload).not.toBeNull();
      expect(payload!.type).toBe(zone.type);
      expect(betTargetSchema.parse(payload!.target)).toEqual(payload!.target);
    }
  });

  it("disallows basket on American wheel", () => {
    expect(isZoneAllowed("basket", AMERICAN_RULES)).toBe("Basket is EU/FR only");
    expect(betPayloadFromZone("basket", CTX, AMERICAN_RULES)).toBeNull();
  });

  it("disallows call bets when allowCallBets is false", () => {
    const rules = { ...DEFAULT_ROULETTE_RULES, allowCallBets: false };
    expect(isZoneAllowed("voisins", rules)).toBe("Call bets not available");
  });
});
