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
    const revealDelayMs = 120;
    let clock = 1_000_000;
    const scheduledDelays: number[] = [];
    const pendingTimers: Array<{ delayMs: number; run: () => void }> = [];

    const server = await startTestServer({
      enableVirtual: true,
      virtualExecutorTiming: {
        nowMs: () => clock,
        setTimeoutFn: ((fn: Parameters<typeof setTimeout>[0], ms?: number) => {
          const delayMs = typeof ms === "number" ? ms : 0;
          pendingTimers.push({
            delayMs,
            run: () => (fn as () => void)(),
          });
          return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout,
      },
    });
    servers.push(server);

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

    const received: Array<{ type: string; source?: string }> = [];
    display.on("message", (msg) => {
      if (msg.op === "event") {
        received.push({
          type: msg.event.type,
          ...(msg.event.type === "LIVE_INPUT" ? { source: msg.event.source } : {}),
          ...(msg.event.type === "RESULT_RECORDED" ? { source: msg.event.result.source } : {}),
        });
      }
    });

    dealer.emit("message", { op: "virtual", kind: "trigger", clientId: "v1" });
    // A second trigger while the reveal sequence is in flight is refused (§14.4).
    dealer.emit("message", { op: "virtual", kind: "trigger", clientId: "v2" });
    const busy = await waitForMessage(dealer, (m) => m.op === "reject" && m.clientId === "v2");
    expect(busy.reason).toBe("DEALING");

    const ackPromise = waitForMessage(dealer, (m) => m.op === "ack" && m.clientId === "v1");
    let acked = false;
    void ackPromise.then(() => {
      acked = true;
    });

    while (!acked) {
      const timer = pendingTimers.shift();
      if (timer) {
        scheduledDelays.push(timer.delayMs);
        clock += timer.delayMs;
        timer.run();
        continue;
      }
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await ackPromise;

    const live = received.filter((e) => e.type === "LIVE_INPUT");
    const result = received.find((e) => e.type === "RESULT_RECORDED");
    expect(live.length).toBeGreaterThanOrEqual(4);
    expect(live.length).toBeLessThanOrEqual(6);
    expect(live.every((e) => e.source === "system")).toBe(true);
    expect(result?.source).toBe("virtual");

    const types = received.map((e) => e.type);
    const resultIndex = types.indexOf("RESULT_RECORDED");
    expect(resultIndex).toBeGreaterThan(0);
    expect(types.slice(0, resultIndex).every((t) => t === "LIVE_INPUT")).toBe(true);
    expect(types.slice(resultIndex + 1).every((t) => t !== "LIVE_INPUT")).toBe(true);

    expect(scheduledDelays).toHaveLength(live.length - 1);
    for (const delay of scheduledDelays) {
      expect(delay).toBe(revealDelayMs);
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

  it("dealer New Series reveals prior seed and commits next series", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url, {
      game: "baccarat",
      participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
    });

    const table = server.registry.get(code)!;
    const series1Start = table.allEvents.find((e) => e.type === "SERIES_STARTED");
    expect(series1Start?.type).toBe("SERIES_STARTED");

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    dealer.emit("message", {
      op: "event",
      clientId: "ns1",
      event: { type: "SERIES_STARTED", seriesId: "client-id", label: "Shoe 2" },
    });
    await waitForMessage(dealer, (m) => m.op === "ack" && m.clientId === "ns1");

    expect(table.allEvents.map((e) => e.type)).toEqual([
      "TABLE_CREATED",
      "SERIES_STARTED",
      "SERIES_ENDED",
      "SERIES_STARTED",
    ]);

    const series1End = table.allEvents.find((e) => e.type === "SERIES_ENDED");
    const seriesStarts = table.allEvents.filter((e) => e.type === "SERIES_STARTED");
    const series2Start = seriesStarts[1];
    expect(series1End?.type).toBe("SERIES_ENDED");
    expect(series2Start?.type).toBe("SERIES_STARTED");
    if (series2Start?.type === "SERIES_STARTED") {
      expect(series2Start.commit).toHaveLength(64);
      expect(series2Start.seriesId).not.toBe("client-id");
    }

    const fair1 = await fetch(`${server.url}/tables/${code}/fairness?series=1`);
    const body1 = (await fair1.json()) as { commit: string; seed?: string; draws: unknown[] };
    expect(body1.seed).toHaveLength(64);
    if (series1Start?.type === "SERIES_STARTED" && series1End?.type === "SERIES_ENDED") {
      expect(series1End.seriesId).toBe(series1Start.seriesId);
      expect(verifyCommit(hexToBytes(body1.seed!), code, series1Start.seriesId, body1.commit)).toBe(
        true,
      );
    }

    const fair2 = await fetch(`${server.url}/tables/${code}/fairness?series=2`);
    const body2 = (await fair2.json()) as { commit: string; seed?: string; draws: unknown[] };
    expect(body2.commit).toHaveLength(64);
    expect(body2.seed).toBeUndefined();
    if (series2Start?.type === "SERIES_STARTED") {
      expect(body2.commit).toBe(series2Start.commit);
    }

    dealer.close();
  });

  it("rejects dealer SERIES_STARTED with client-supplied commit", async () => {
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
      clientId: "bad-commit",
      event: {
        type: "SERIES_STARTED",
        seriesId: "client-id",
        commit: "deadbeef".repeat(8),
      },
    });
    const reject = await waitForMessage(
      dealer,
      (m) => m.op === "reject" && m.clientId === "bad-commit",
    );
    expect(reject.reason).toBe("client commit not allowed");

    const table = server.registry.get(code)!;
    expect(table.allEvents.map((e) => e.type)).toEqual(["TABLE_CREATED", "SERIES_STARTED"]);

    dealer.close();
  });

  it("dealer End Session reveals seed before SESSION_ENDED", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url, {
      game: "baccarat",
      participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
    });

    const table = server.registry.get(code)!;
    const series1Start = table.allEvents.find((e) => e.type === "SERIES_STARTED");
    expect(series1Start?.type).toBe("SERIES_STARTED");

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    dealer.emit("message", {
      op: "event",
      clientId: "end1",
      event: { type: "SESSION_ENDED" },
    });
    await waitForMessage(dealer, (m) => m.op === "ack" && m.clientId === "end1");

    const types = table.allEvents.map((e) => e.type);
    expect(types).toEqual(["TABLE_CREATED", "SERIES_STARTED", "SERIES_ENDED", "SESSION_ENDED"]);

    const fair1 = await fetch(`${server.url}/tables/${code}/fairness?series=1`);
    const body1 = (await fair1.json()) as { commit: string; seed?: string; draws: unknown[] };
    expect(body1.seed).toHaveLength(64);
    if (series1Start?.type === "SERIES_STARTED") {
      expect(verifyCommit(hexToBytes(body1.seed!), code, series1Start.seriesId, body1.commit)).toBe(
        true,
      );
    }

    dealer.close();
  });
});
