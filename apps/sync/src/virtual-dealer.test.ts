import { verifyCommit, type TableEvent } from "@casino-lord/core";
import { afterEach, describe, expect, it } from "vitest";
import { baccaratVirtualStep } from "@casino-lord/game-baccarat";
import { createSeededRng, hexToBytes } from "@casino-lord/core";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { initialState } from "@casino-lord/game-baccarat";
import { resultRecordedEvent } from "./test-helpers/baccarat-result.js";
import {
  connectClient,
  createTableViaRest,
  startTestServer,
  waitForMessage,
} from "./test-helpers/server.js";

const servers: Array<Awaited<ReturnType<typeof startTestServer>>> = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) {
      await server.close();
    }
  }
});

async function boot(enableVirtual = true) {
  const server = await startTestServer({ enableVirtual });
  servers.push(server);
  return server;
}

describe("virtual dealer", () => {
  it("creates virtual table with SERIES_STARTED commit", async () => {
    const server = await boot();
    const { code } = await createTableViaRest(server.url, {
      game: "baccarat",
      participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
    });
    const table = server.registry.get(code)!;
    const events = [...table.allEvents];
    expect(events.map((e) => e.type)).toEqual(["TABLE_CREATED", "SERIES_STARTED"]);
    const start = events[1];
    expect(start?.type).toBe("SERIES_STARTED");
    if (start?.type === "SERIES_STARTED") {
      expect(start.commit).toHaveLength(64);
    }
  });

  it("rejects virtual table creation when ENABLE_VIRTUAL=false", async () => {
    const server = await boot(false);
    const response = await fetch(`${server.url}/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "baccarat",
        participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
      }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()) as { error: string }).toEqual({ error: "VIRTUAL_DISABLED" });
  });

  it("dealer virtual trigger deals paced LIVE_INPUT then RESULT_RECORDED", async () => {
    const server = await boot();
    const revealDelayMs = 120;
    const { code, dealerToken } = await createTableViaRest(server.url, {
      game: "baccarat",
      participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
      settings: { virtual: { revealDelayMs } },
    });

    const display = connectClient(server.url);
    await new Promise<void>((resolve) => display.on("connect", () => resolve()));
    display.emit("message", { op: "join", code, role: "display" });
    await waitForMessage(display, (m) => m.op === "joined");

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    const received: Array<{ type: string; source?: string; arrivedAt: number }> = [];
    display.on("message", (msg) => {
      if (msg.op === "event") {
        received.push({
          type: msg.event.type,
          arrivedAt: Date.now(),
          ...(msg.event.type === "LIVE_INPUT" ? { source: msg.event.source } : {}),
          ...(msg.event.type === "RESULT_RECORDED" ? { source: msg.event.result.source } : {}),
        });
      }
    });

    const triggeredAt = Date.now();
    dealer.emit("message", { op: "virtual", kind: "trigger", clientId: "v1" });
    // A second trigger while the reveal sequence is in flight is refused (§14.4).
    dealer.emit("message", { op: "virtual", kind: "trigger", clientId: "v2" });
    const busy = await waitForMessage(dealer, (m) => m.op === "reject" && m.clientId === "v2");
    expect(busy.reason).toBe("DEALING");

    await waitForMessage(dealer, (m) => m.op === "ack" && m.clientId === "v1");
    await new Promise((r) => setTimeout(r, 50));

    const live = received.filter((e) => e.type === "LIVE_INPUT");
    const result = received.find((e) => e.type === "RESULT_RECORDED");
    expect(live.length).toBeGreaterThanOrEqual(4);
    expect(live.length).toBeLessThanOrEqual(6);
    expect(live.every((e) => e.source === "system")).toBe(true);
    expect(result?.source).toBe("virtual");

    // Reveals arrive spaced in time, not in one burst: the whole sequence takes
    // at least (n − 1) × revealDelayMs, and the ack comes after the last event.
    const span = live[live.length - 1]!.arrivedAt - triggeredAt;
    expect(span).toBeGreaterThanOrEqual((live.length - 1) * revealDelayMs - 20);
    for (let i = 1; i < live.length; i++) {
      expect(live[i]!.arrivedAt - live[i - 1]!.arrivedAt).toBeGreaterThanOrEqual(
        revealDelayMs - 20,
      );
    }

    display.close();
    dealer.close();
  });

  it("physical table rejects virtual trigger with NOT_VIRTUAL", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    dealer.emit("message", { op: "virtual", kind: "trigger", clientId: "v1" });
    const reject = await waitForMessage(dealer, (m) => m.op === "reject" && m.clientId === "v1");
    expect(reject.reason).toBe("NOT_VIRTUAL");

    dealer.close();
  });

  it("virtual table rejects dealer RESULT_RECORDED with MIXED_SERIES", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url, {
      game: "baccarat",
      participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
    });

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    dealer.emit("message", {
      op: "event",
      clientId: "e1",
      event: resultRecordedEvent(1, "r1"),
    });
    const reject = await waitForMessage(dealer, (m) => m.op === "reject" && m.clientId === "e1");
    expect(reject.reason).toBe("MIXED_SERIES");

    dealer.close();
  });

  it("fairness hides seed until series ends and verifyCommit succeeds after reveal", async () => {
    const server = await boot();
    const { code } = await createTableViaRest(server.url, {
      game: "baccarat",
      participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
    });

    const table = server.registry.get(code)!;
    const start = table.allEvents.find((e) => e.type === "SERIES_STARTED");
    expect(start?.type).toBe("SERIES_STARTED");

    const before = await fetch(`${server.url}/tables/${code}/fairness?series=1`);
    const beforeBody = (await before.json()) as { commit: string; seed?: string; draws: unknown[] };
    expect(beforeBody.commit).toHaveLength(64);
    expect(beforeBody.seed).toBeUndefined();

    const virtualDealer = server.registry.getVirtualDealer(code)!;
    const at = new Date().toISOString();
    const endEvent = virtualDealer.endSeriesEvent();
    const appended = table.appendEvent(endEvent, "test-series-end", at);
    expect(appended.kind).toBe("new");
    if (appended.kind === "new") {
      server.registry.persistEvent(code, appended.event);
    }

    const after = await fetch(`${server.url}/tables/${code}/fairness?series=1`);
    const afterBody = (await after.json()) as { commit: string; seed?: string; draws: unknown[] };
    expect(afterBody.seed).toHaveLength(64);
    if (start?.type !== "SERIES_STARTED") {
      throw new Error("missing SERIES_STARTED");
    }
    expect(verifyCommit(hexToBytes(afterBody.seed!), code, start.seriesId, afterBody.commit)).toBe(
      true,
    );
  });

  it("appendix C replay reproduces virtual results from revealed seed", async () => {
    const seed = hexToBytes("010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20");
    const rng = createSeededRng(seed);
    let session = null;
    const out = baccaratVirtualStep({
      state: initialState(DEFAULT_BACCARAT_RULES),
      rules: DEFAULT_BACCARAT_RULES,
      rng,
      trigger: "deal",
      session,
      seriesId: "s1",
    });
    session = out.session;
    const loggedRaw = out.events.find((e) => e.type === "RESULT_RECORDED");
    const logged = loggedRaw as Extract<TableEvent, { type: "RESULT_RECORDED" }> | undefined;
    expect(logged).toBeDefined();

    const replayRng = createSeededRng(seed);
    const replay = baccaratVirtualStep({
      state: initialState(DEFAULT_BACCARAT_RULES),
      rules: DEFAULT_BACCARAT_RULES,
      rng: replayRng,
      trigger: "deal",
      session: null,
      seriesId: "s1",
    });
    const replayRaw = replay.events.find((e) => e.type === "RESULT_RECORDED");
    const replayResult = replayRaw as Extract<TableEvent, { type: "RESULT_RECORDED" }> | undefined;
    expect(replayResult).toBeDefined();
    if (!logged || !replayResult) return;
    expect(replayResult.result.data).toEqual(logged.result.data);
  });
});
