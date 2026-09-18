import { PLAYER_COLORS } from "@casino-lord/core";
import { afterEach, describe, expect, it } from "vitest";
import { PLAYER_JOIN_LIMIT } from "../rate-limit.js";
import {
  connectClient,
  createPlayerModeTable,
  createTableViaRest,
  joinPlayerViaRest,
  PLAYER_MODE_PARTICIPATION,
  startTestServer,
  waitForMessage,
} from "../test-helpers/server.js";

const servers: Array<Awaited<ReturnType<typeof startTestServer>>> = [];
const sockets: ReturnType<typeof connectClient>[] = [];

afterEach(async () => {
  while (sockets.length > 0) sockets.pop()?.disconnect();
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) await server.close();
  }
});

async function boot(options: Parameters<typeof startTestServer>[0] = {}) {
  const server = await startTestServer(options);
  servers.push(server);
  return server;
}

async function joinRaw(
  url: string,
  code: string,
  body: { name: string; color: string },
): Promise<{ status: number; error?: string }> {
  const response = await fetch(`${url}/tables/${code}/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return { status: response.status, ...(data.error ? { error: data.error } : {}) };
}

async function connectDealer(url: string, code: string, dealerToken: string) {
  const dealer = connectClient(url);
  sockets.push(dealer);
  await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
  dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
  await waitForMessage(dealer, (m) => m.op === "joined");
  return dealer;
}

async function connectPlayer(url: string, code: string, token: string) {
  const player = connectClient(url);
  sockets.push(player);
  await new Promise<void>((resolve) => player.on("connect", () => resolve()));
  player.emit("message", { op: "join", code, role: "player", token });
  return player;
}

describe("player onboarding — join approval", () => {
  it("holds the player pending and tells the dealer, then admits on approve", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url, {
      game: "baccarat",
      participation: PLAYER_MODE_PARTICIPATION,
      settings: { players: { joinApproval: true } },
    });

    const dealer = await connectDealer(server.url, code, dealerToken);
    const pendingPush = waitForMessage<{
      op: string;
      players?: Array<{ id: string; name: string }>;
    }>(dealer, (m) => m.op === "pending");

    const joined = await joinPlayerViaRest(server.url, code, {
      name: "Ana",
      color: PLAYER_COLORS[0]!,
    });
    expect(joined.pending).toBe(true);

    const pending = await pendingPush;
    expect(pending.players?.map((p) => p.name)).toEqual(["Ana"]);

    // A pending player still holds their colour, so a second phone cannot take it.
    const meta = (await fetch(`${server.url}/tables/${code}`).then((r) => r.json())) as {
      players: number;
      takenColors: string[];
    };
    expect(meta.players).toBe(0);
    expect(meta.takenColors).toEqual([PLAYER_COLORS[0]]);

    const playerJoinedEvent = waitForMessage<{
      op: string;
      event?: { type: string; player?: { name: string } };
    }>(dealer, (m) => m.op === "event" && m.event?.type === "PLAYER_JOINED");

    dealer.emit("message", { op: "admit", playerId: joined.playerId, accept: true });

    const event = await playerJoinedEvent;
    expect(event.event?.player?.name).toBe("Ana");

    const after = (await fetch(`${server.url}/tables/${code}`).then((r) => r.json())) as {
      players: number;
    };
    expect(after.players).toBe(1);
  });

  it("tells a declined player why and drops their socket", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url, {
      game: "baccarat",
      participation: PLAYER_MODE_PARTICIPATION,
      settings: { players: { joinApproval: true } },
    });

    const dealer = await connectDealer(server.url, code, dealerToken);
    const pendingPush = waitForMessage(dealer, (m) => m.op === "pending");
    const joined = await joinPlayerViaRest(server.url, code, {
      name: "Ana",
      color: PLAYER_COLORS[0]!,
    });
    await pendingPush;

    const player = await connectPlayer(server.url, code, joined.playerToken);
    await waitForMessage(player, (m) => m.op === "joined");

    const rejected = waitForMessage<{ op: string; reason?: string }>(
      player,
      (m) => m.op === "reject",
    );
    dealer.emit("message", { op: "admit", playerId: joined.playerId, accept: false });

    expect((await rejected).reason).toBe("DECLINED");
  });

  it("issues a usable token that authenticates the player socket", async () => {
    const server = await boot();
    const { code } = await createPlayerModeTable(server.url);
    const joined = await joinPlayerViaRest(server.url, code, {
      name: "Ana",
      color: PLAYER_COLORS[0]!,
    });

    const player = await connectPlayer(server.url, code, joined.playerToken);
    const ack = await waitForMessage<{ op: string; playerId?: string; role?: string }>(
      player,
      (m) => m.op === "joined" || m.op === "error",
    );

    expect(ack.op).toBe("joined");
    expect(ack.role).toBe("player");
    expect(ack.playerId).toBe(joined.playerId);
  });

  it("rejects a socket join with no token or a stale token", async () => {
    const server = await boot();
    const { code } = await createPlayerModeTable(server.url);

    const noToken = connectClient(server.url);
    sockets.push(noToken);
    await new Promise<void>((resolve) => noToken.on("connect", () => resolve()));
    noToken.emit("message", { op: "join", code, role: "player" });
    expect((await waitForMessage<{ op: string; code?: string }>(noToken, () => true)).code).toBe(
      "BAD_TOKEN",
    );

    const stale = await connectPlayer(server.url, code, "0".repeat(32));
    expect((await waitForMessage<{ op: string; code?: string }>(stale, () => true)).code).toBe(
      "BAD_TOKEN",
    );
  });
});

describe("player onboarding — refusals the UI has copy for", () => {
  it("404s an unknown table code", async () => {
    const server = await boot();
    expect(await joinRaw(server.url, "ZZZZZZ", { name: "Ana", color: PLAYER_COLORS[0]! })).toEqual({
      status: 404,
      error: "NOT_FOUND",
    });
  });

  it("409s JOINING_CLOSED after the dealer closes joining", async () => {
    const server = await boot();
    const { code, dealerToken } = await createPlayerModeTable(server.url);
    const dealer = await connectDealer(server.url, code, dealerToken);

    dealer.emit("message", {
      op: "event",
      clientId: "close-joining",
      event: { type: "SETTINGS_CHANGED", patch: { players: { joiningOpen: false } } },
    });
    await waitForMessage(dealer, (m) => m.op === "ack");

    expect(await joinRaw(server.url, code, { name: "Ana", color: PLAYER_COLORS[0]! })).toEqual({
      status: 409,
      error: "JOINING_CLOSED",
    });
  });

  it("409s TABLE_FULL once maxPlayers is reached", async () => {
    const server = await boot();
    const { code } = await createTableViaRest(server.url, {
      game: "baccarat",
      participation: PLAYER_MODE_PARTICIPATION,
      settings: { players: { maxPlayers: 1 } },
    });

    await joinPlayerViaRest(server.url, code, { name: "Ana", color: PLAYER_COLORS[0]! });

    expect(await joinRaw(server.url, code, { name: "Ben", color: PLAYER_COLORS[1]! })).toEqual({
      status: 409,
      error: "TABLE_FULL",
    });
  });

  it("409s SESSION_ENDED after the dealer ends the session", async () => {
    const server = await boot();
    const { code, dealerToken } = await createPlayerModeTable(server.url);
    const dealer = await connectDealer(server.url, code, dealerToken);

    dealer.emit("message", {
      op: "event",
      clientId: "end-session",
      event: { type: "SESSION_ENDED" },
    });
    await waitForMessage(dealer, (m) => m.op === "ack");

    expect(await joinRaw(server.url, code, { name: "Ana", color: PLAYER_COLORS[0]! })).toEqual({
      status: 409,
      error: "SESSION_ENDED",
    });
  });

  it("400s a name outside 2–16 characters", async () => {
    const server = await boot();
    const { code } = await createPlayerModeTable(server.url);

    expect(await joinRaw(server.url, code, { name: "A", color: PLAYER_COLORS[0]! })).toEqual({
      status: 400,
      error: "INVALID_NAME",
    });
    expect(
      await joinRaw(server.url, code, { name: "A".repeat(17), color: PLAYER_COLORS[0]! }),
    ).toEqual({ status: 400, error: "INVALID_NAME" });
  });
});

describe("player onboarding — a whole room joining at once", () => {
  it("lets a full table's worth of guests join from one shared IP", async () => {
    // Everyone at a venue shares one NAT address, so they share one rate-limit
    // bucket. The limit has to clear the table's own capacity.
    const server = await boot();
    const { code } = await createTableViaRest(server.url, {
      game: "baccarat",
      participation: PLAYER_MODE_PARTICIPATION,
      settings: { players: { maxPlayers: 20 } },
    });

    expect(PLAYER_JOIN_LIMIT).toBeGreaterThanOrEqual(20);

    for (let i = 0; i < 20; i += 1) {
      const result = await joinRaw(server.url, code, {
        name: `Guest${i}`,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length]!,
      });
      expect(result.status, `guest ${i} was refused with ${result.error}`).toBe(201);
    }

    const meta = (await fetch(`${server.url}/tables/${code}`).then((r) => r.json())) as {
      players: number;
    };
    expect(meta.players).toBe(20);
  });

  it("still rate-limits once the bucket is spent", async () => {
    const server = await boot();
    const { code } = await createTableViaRest(server.url, {
      game: "baccarat",
      participation: PLAYER_MODE_PARTICIPATION,
      settings: { players: { maxPlayers: 50 } },
    });

    let lastStatus = 0;
    for (let i = 0; i <= PLAYER_JOIN_LIMIT; i += 1) {
      const result = await joinRaw(server.url, code, {
        name: `Guest${i}`,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length]!,
      });
      lastStatus = result.status;
    }

    expect(lastStatus).toBe(429);
  });
});
