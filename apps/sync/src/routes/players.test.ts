import { PLAYER_COLORS } from "@casino-lord/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPlayerModeTable,
  createTableViaRest,
  joinPlayerViaRest,
  startTestServer,
} from "../test-helpers/server.js";

const servers: Array<Awaited<ReturnType<typeof startTestServer>>> = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) await server.close();
  }
});

async function boot() {
  const server = await startTestServer();
  servers.push(server);
  return server;
}

describe("player REST routes", () => {
  it("POST /tables/:code/players joins immediately when joinApproval is off", async () => {
    const server = await boot();
    const { code } = await createPlayerModeTable(server.url);

    const joined = await joinPlayerViaRest(server.url, code, {
      name: "Ana",
      color: PLAYER_COLORS[0]!,
    });

    expect(joined.pending).toBe(false);
    expect(joined.playerId).toBeTruthy();
    expect(joined.playerToken).toHaveLength(32);

    const meta = await fetch(`${server.url}/tables/${code}`).then((r) => r.json());
    expect(meta.players).toBe(1);
  });

  it("rejects invalid name and colour", async () => {
    const server = await boot();
    const { code } = await createPlayerModeTable(server.url);

    const badName = await fetch(`${server.url}/tables/${code}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A", color: PLAYER_COLORS[0] }),
    });
    expect(badName.status).toBe(400);

    const badColor = await fetch(`${server.url}/tables/${code}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ana", color: "#000000" }),
    });
    expect(badColor.status).toBe(400);
  });

  it("returns 403 when player mode is off", async () => {
    const server = await boot();
    const { code } = await createTableViaRest(server.url);

    const response = await fetch(`${server.url}/tables/${code}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ana", color: PLAYER_COLORS[0] }),
    });
    expect(response.status).toBe(403);
  });

  it("reissue rotates token and requires dealer auth", async () => {
    const server = await boot();
    const { code, dealerToken } = await createPlayerModeTable(server.url);
    const joined = await joinPlayerViaRest(server.url, code, {
      name: "Ben",
      color: PLAYER_COLORS[1]!,
    });

    const unauthorized = await fetch(
      `${server.url}/tables/${code}/players/${joined.playerId}/reissue`,
      {
        method: "POST",
      },
    );
    expect(unauthorized.status).toBe(401);

    const reissued = await fetch(
      `${server.url}/tables/${code}/players/${joined.playerId}/reissue`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${dealerToken}` },
      },
    );
    expect(reissued.status).toBe(200);
    const body = (await reissued.json()) as { playerToken: string };
    expect(body.playerToken).not.toBe(joined.playerToken);
  });
});
