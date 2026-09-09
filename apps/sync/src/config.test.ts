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

  it("rejects PERSIST=redis with explicit message", () => {
    expect(() =>
      loadConfig({
        PORT: "3000",
        PERSIST: "redis",
      }),
    ).toThrow("PERSIST=redis is not supported yet");
  });

  it("accepts valid PERSIST values with defaults", () => {
    const config = loadConfig({
      PORT: "3000",
      PERSIST: "memory",
      SQLITE_PATH: "/tmp/test.db",
      TABLE_TTL_HOURS: "6",
      TABLE_RETENTION_DAYS: "30",
      ENABLE_PLAYER_MODE: "true",
      ENABLE_VIRTUAL: "true",
      MAX_PLAYERS_HARD: "50",
    });

    expect(config.persist).toBe("memory");
    expect(config.port).toBe(3000);
    expect(config.sqlitePath).toBe("/tmp/test.db");
    expect(config.tableRetentionDays).toBe(30);
    expect(config.enabledGames).toEqual(["baccarat", "roulette", "craps", "blackjack"]);
  });
});
