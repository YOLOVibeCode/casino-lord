import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "../test-fixtures/static");

const apps: Array<Awaited<ReturnType<typeof buildServer>>> = [];

afterEach(async () => {
  while (apps.length > 0) {
    const app = apps.pop();
    if (app) {
      await app.close();
    }
  }
});

describe("buildServer", () => {
  it("returns healthz shape", async () => {
    const app = await buildServer({ staticRoot: fixtureRoot });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      uptimeSeconds: expect.any(Number),
    });
  });

  it("returns version fallback when version.json is missing", async () => {
    const app = await buildServer({ staticRoot: fixtureRoot });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/version.json" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      version: "dev",
      commit: null,
      builtAt: null,
    });
  });

  it("returns the static games registry", async () => {
    const app = await buildServer({ staticRoot: fixtureRoot });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/games" });
    const games = response.json() as Array<{ id: string; enabled: boolean }>;

    expect(response.statusCode).toBe(200);
    expect(games).toHaveLength(4);
    expect(games.find((game) => game.id === "baccarat")?.enabled).toBe(true);
    expect(games.filter((game) => game.id !== "baccarat").every((game) => !game.enabled)).toBe(
      true,
    );
  });

  it("serves index.html for SPA routes", async () => {
    const app = await buildServer({ staticRoot: fixtureRoot });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/solo/baccarat" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body.trim().toLowerCase()).toMatch(/^<!doctype html>/);
  });

  it("returns 404 for missing asset files", async () => {
    const app = await buildServer({ staticRoot: fixtureRoot });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/assets/missing.js" });

    expect(response.statusCode).toBe(404);
  });
});
