import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("rejects unknown PERSIST values", () => {
    expect(() =>
      loadConfig({
        ...process.env,
        PERSIST: "postgres",
      }),
    ).toThrow();
  });

  it("accepts valid PERSIST values with defaults", () => {
    const config = loadConfig({
      PORT: "3000",
      PERSIST: "memory",
      TABLE_TTL_HOURS: "6",
      ENABLE_PLAYER_MODE: "true",
      ENABLE_VIRTUAL: "true",
      MAX_PLAYERS_HARD: "50",
    });

    expect(config.persist).toBe("memory");
    expect(config.port).toBe(3000);
    expect(config.enabledGames).toEqual(["baccarat", "roulette", "craps", "blackjack"]);
  });
});
