import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import type { Config } from "../config.js";
import { loadConfig } from "../config.js";
import { createRepository } from "../persistence/index.js";
import { createRateLimiter } from "../rate-limit.js";
import { buildServer } from "../server.js";
import { TableRegistry } from "../tables/registry.js";

export interface TestSyncServer {
  url: string;
  config: Config;
  registry: TableRegistry;
  rateLimiter: ReturnType<typeof createRateLimiter>;
  close: () => Promise<void>;
}

export interface StartTestServerOptions {
  persist?: "memory" | "sqlite";
  sqlitePath?: string;
  now?: () => string;
  rng?: () => number;
  rateLimiter?: ReturnType<typeof createRateLimiter>;
  enableVirtual?: boolean;
}

export async function startTestServer(
  options: StartTestServerOptions = {},
): Promise<TestSyncServer> {
  const dir = join(
    tmpdir(),
    `casino-lord-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  const sqlitePath = options.sqlitePath ?? join(dir, "test.db");

  const config = loadConfig({
    PORT: "3000",
    PERSIST: options.persist ?? "memory",
    SQLITE_PATH: sqlitePath,
    TABLE_TTL_HOURS: "6",
    TABLE_RETENTION_DAYS: "30",
    ENABLE_PLAYER_MODE: "true",
    ENABLE_VIRTUAL: options.enableVirtual === false ? "false" : "true",
    MAX_PLAYERS_HARD: "50",
  });

  const repository = createRepository(config);
  const rateLimiter = options.rateLimiter ?? createRateLimiter();
  const registry = new TableRegistry({
    config,
    repository,
    ...(options.now ? { now: options.now } : {}),
    ...(options.rng ? { rng: options.rng } : {}),
    setIntervalFn: ((..._args: unknown[]) => 0) as typeof setInterval,
    clearIntervalFn: () => undefined,
  });

  const { app, io } = await buildServer({ config, registry, rateLimiter });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  const port = typeof address === "object" && address ? address.port : 3000;

  return {
    url: `http://127.0.0.1:${port}`,
    config,
    registry,
    rateLimiter,
    close: async () => {
      registry.stop();
      io?.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function connectClient(url: string): ClientSocket {
  return createClient(url, {
    path: "/ws",
    transports: ["websocket"],
  });
}

export function waitForMessage<T = Record<string, unknown>>(
  socket: ClientSocket,
  predicate: (msg: T) => boolean,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("timeout waiting for message"));
    }, timeoutMs);

    function onMessage(msg: T): void {
      if (predicate(msg)) {
        clearTimeout(timer);
        socket.off("message", onMessage);
        resolve(msg);
      }
    }

    socket.on("message", onMessage);
  });
}

export const PLAYER_MODE_PARTICIPATION = {
  playerMode: "on" as const,
  bank: "none" as const,
  outcomeSource: "physical" as const,
};

export async function createPlayerModeTable(url: string): Promise<{
  code: string;
  dealerToken: string;
}> {
  return createTableViaRest(url, {
    game: "baccarat",
    participation: PLAYER_MODE_PARTICIPATION,
  });
}

export async function joinPlayerViaRest(
  url: string,
  code: string,
  body: { name: string; color: string },
): Promise<{ playerId: string; playerToken: string; pending: boolean }> {
  const response = await fetch(`${url}/tables/${code}/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `join player failed: ${response.status}`);
  }
  return (await response.json()) as {
    playerId: string;
    playerToken: string;
    pending: boolean;
  };
}

export async function createTableViaRest(
  url: string,
  body: Record<string, unknown> = {
    game: "baccarat",
    participation: { playerMode: "off", bank: "none", outcomeSource: "physical" },
  },
): Promise<{ code: string; dealerToken: string }> {
  const response = await fetch(`${url}/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`create table failed: ${response.status}`);
  }
  return (await response.json()) as { code: string; dealerToken: string };
}
