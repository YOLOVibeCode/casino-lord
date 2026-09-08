import { describe, expect, it } from "vitest";
import { DEFAULT_PARTICIPATION, GAME_IDS, validateParticipation } from "./types.js";

describe("GAME_IDS", () => {
  it("lists the four launch games", () => {
    expect(GAME_IDS).toEqual(["baccarat", "roulette", "craps", "blackjack"]);
  });
});

describe("validateParticipation", () => {
  it("accepts the default (pure scoreboard)", () => {
    expect(validateParticipation(DEFAULT_PARTICIPATION)).toBeNull();
  });

  it("rejects a house bank without players", () => {
    expect(
      validateParticipation({ playerMode: "off", bank: "house", outcomeSource: "physical" }),
    ).toMatch(/playerMode=on/);
  });

  it("accepts every other combination", () => {
    for (const playerMode of ["off", "on"] as const) {
      for (const bank of ["none", "house"] as const) {
        for (const outcomeSource of ["physical", "virtual"] as const) {
          if (bank === "house" && playerMode === "off") continue;
          expect(validateParticipation({ playerMode, bank, outcomeSource })).toBeNull();
        }
      }
    }
  });
});
