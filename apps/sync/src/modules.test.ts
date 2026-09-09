import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { getModule, isGameEnabled } from "./modules.js";
import { createTableViaRest, startTestServer } from "./test-helpers/server.js";

describe("roulette module registration", () => {
  it("registers roulette module and default rules", () => {
    expect(getModule("roulette")).not.toBeNull();
  });

  it("enables roulette when config allows", () => {
    const config = loadConfig({
      PORT: "3000",
      PERSIST: "memory",
    });
    expect(isGameEnabled(config, "roulette")).toBe(true);
  });

  it("POST /tables accepts game roulette", async () => {
    const server = await startTestServer();
    try {
      const result = await createTableViaRest(server.url, {
        game: "roulette",
        participation: { playerMode: "off", bank: "none", outcomeSource: "physical" },
      });
      expect(result.code).toMatch(/^[A-Z0-9]{6}$/);
      expect(result.dealerToken.length).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });
});
