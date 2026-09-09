import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { createMemoryRepository } from "./persistence/memory.js";
import { buildServer } from "./server.js";
import { TableRegistry } from "./tables/registry.js";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "../test-fixtures/static");

interface TestServerHandle {
  built: Awaited<ReturnType<typeof buildServer>>;
  registry: TableRegistry;
}

const servers: TestServerHandle[] = [];

function testConfig() {
  return loadConfig({
    PORT: "3000",
    PERSIST: "memory",
    TABLE_TTL_HOURS: "6",
    TABLE_RETENTION_DAYS: "30",
    ENABLE_PLAYER_MODE: "true",
    ENABLE_VIRTUAL: "true",
    MAX_PLAYERS_HARD: "50",
  });
}

afterEach(async () => {
  while (servers.length > 0) {
    const handle = servers.pop();
    if (handle) {
      handle.registry.stop();
      handle.built.io?.close();
      await handle.built.app.close();
    }
  }
});

async function buildTestServer(): Promise<TestServerHandle> {
  const config = testConfig();
  const repository = createMemoryRepository();
  const registry = new TableRegistry({ config, repository });
  const built = await buildServer({ staticRoot: fixtureRoot, registry, config });
  const handle = { built, registry };
  servers.push(handle);
  return handle;
}

describe("buildServer", () => {
  it("returns healthz shape", async () => {
    const {
      built: { app },
    } = await buildTestServer();

    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      uptimeSeconds: expect.any(Number),
    });
  });

  it("returns version fallback when version.json is missing", async () => {
    const {
      built: { app },
    } = await buildTestServer();

    const response = await app.inject({ method: "GET", url: "/version.json" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      version: "dev",
      commit: null,
      builtAt: null,
    });
  });

  it("returns the static games registry", async () => {
    const {
      built: { app },
    } = await buildTestServer();

    const response = await app.inject({ method: "GET", url: "/games" });
    const games = response.json() as Array<{ id: string; enabled: boolean }>;

    expect(response.statusCode).toBe(200);
    expect(games).toHaveLength(4);
    expect(games.find((game) => game.id === "baccarat")?.enabled).toBe(true);
    expect(games.find((game) => game.id === "craps")?.enabled).toBe(true);
    expect(
      games
        .filter((game) => game.id !== "baccarat" && game.id !== "craps")
        .every((game) => !game.enabled),
    ).toBe(true);
  });

  it("serves index.html for SPA routes", async () => {
    const {
      built: { app },
    } = await buildTestServer();

    const response = await app.inject({ method: "GET", url: "/solo/baccarat" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body.trim().toLowerCase()).toMatch(/^<!doctype html>/);
  });

  it("returns 404 for missing asset files", async () => {
    const {
      built: { app },
    } = await buildTestServer();

    const response = await app.inject({ method: "GET", url: "/assets/missing.js" });

    expect(response.statusCode).toBe(404);
  });
});
