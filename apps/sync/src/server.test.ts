import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  vi.unstubAllEnvs();
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

const FULL_SHA = "a".repeat(40);

function expectHealthShape(body: Record<string, unknown>): void {
  expect(body).toEqual({
    ok: true,
    uptimeSeconds: expect.any(Number),
    enableVirtual: true,
    service: "casino-lord",
    commit: expect.any(String),
    env: expect.any(String),
    utc: expect.any(String),
  });
  expect(typeof body["utc"]).toBe("string");
  expect(Number.isNaN(Date.parse(String(body["utc"])))).toBe(false);
}

describe("buildServer", () => {
  it("returns healthz shape", async () => {
    const {
      built: { app },
    } = await buildTestServer();

    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expectHealthShape(response.json() as Record<string, unknown>);
  });

  it("serves the same health payload on /health and /api/health", async () => {
    const {
      built: { app },
    } = await buildTestServer();

    const healthz = await app.inject({ method: "GET", url: "/healthz" });
    const health = await app.inject({ method: "GET", url: "/health" });
    const apiHealth = await app.inject({ method: "GET", url: "/api/health" });

    expect(health.statusCode).toBe(200);
    expect(apiHealth.statusCode).toBe(200);
    expect(Object.keys(health.json() as object).sort()).toEqual(
      Object.keys(healthz.json() as object).sort(),
    );
    expect(Object.keys(apiHealth.json() as object).sort()).toEqual(
      Object.keys(healthz.json() as object).sort(),
    );
  });

  it("uses RAILWAY_GIT_COMMIT_SHA for commit when set", async () => {
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", FULL_SHA);
    const {
      built: { app },
    } = await buildTestServer();

    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { commit: string }).commit).toBe(FULL_SHA);
  });

  it('returns commit "unknown" when commit env vars are unset', async () => {
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "");
    vi.stubEnv("GIT_COMMIT", "");
    const {
      built: { app },
    } = await buildTestServer();

    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { commit: string }).commit).toBe("unknown");
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
    const body = response.json() as {
      enableVirtual: boolean;
      games: Array<{ id: string; enabled: boolean }>;
    };

    expect(response.statusCode).toBe(200);
    expect(body.enableVirtual).toBe(true);
    expect(body.games).toHaveLength(4);
    expect(body.games.find((game) => game.id === "baccarat")?.enabled).toBe(true);
    expect(body.games.find((game) => game.id === "roulette")?.enabled).toBe(true);
    expect(body.games.find((game) => game.id === "craps")?.enabled).toBe(true);
    expect(body.games.find((game) => game.id === "blackjack")?.enabled).toBe(true);
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
