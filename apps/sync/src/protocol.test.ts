import { stableStringify, replay } from "@casino-lord/core";
import { afterEach, describe, expect, it } from "vitest";
import { getModule, resolveRules } from "./modules.js";
import { resultRecordedEvent } from "./test-helpers/baccarat-result.js";
import {
  connectClient,
  createTableViaRest,
  startTestServer,
  waitForMessage,
} from "./test-helpers/server.js";

interface JoinedMessage {
  op: "joined";
  events?: Array<{ seq: number }>;
  snapshot?: Array<{ seq: number }>;
}

const servers: Array<Awaited<ReturnType<typeof startTestServer>>> = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) {
      await server.close();
    }
  }
});

async function boot() {
  const server = await startTestServer();
  servers.push(server);
  return server;
}

describe("sync protocol", () => {
  it("create → display join → dealer emits 3 results → display receives seq 2..4", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);

    const display = connectClient(server.url);
    await new Promise<void>((resolve) => display.on("connect", () => resolve()));
    display.emit("message", { op: "join", code, role: "display" });
    await waitForMessage(display, (m) => m.op === "joined");

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    const received: number[] = [];
    display.on("message", (msg) => {
      if (msg.op === "event" && msg.event?.type === "RESULT_RECORDED") {
        received.push(msg.event.seq);
      }
    });

    for (let i = 1; i <= 3; i++) {
      dealer.emit("message", {
        op: "event",
        clientId: `c${i}`,
        event: resultRecordedEvent(i, `r${i}`),
      });
      await waitForMessage(dealer, (m) => m.op === "ack" && m.clientId === `c${i}`);
    }

    await new Promise((r) => setTimeout(r, 100));
    expect(received).toEqual([2, 3, 4]);

    display.close();
    dealer.close();
  });

  it("duplicate clientId returns same seq and is not re-broadcast", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);

    const display = connectClient(server.url);
    await new Promise<void>((resolve) => display.on("connect", () => resolve()));
    display.emit("message", { op: "join", code, role: "display" });
    await waitForMessage(display, (m) => m.op === "joined");

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    let broadcastCount = 0;
    display.on("message", (msg) => {
      if (msg.op === "event" && msg.event?.type === "RESULT_RECORDED") {
        broadcastCount += 1;
      }
    });

    const event = resultRecordedEvent(1, "r1");
    dealer.emit("message", { op: "event", clientId: "dup", event });
    const ack1 = await waitForMessage(dealer, (m) => m.op === "ack" && m.clientId === "dup");

    dealer.emit("message", { op: "event", clientId: "dup", event });
    const ack2 = await waitForMessage(dealer, (m) => m.op === "ack" && m.clientId === "dup");

    expect(ack1.seq).toBe(2);
    expect(ack2.seq).toBe(2);
    await new Promise((r) => setTimeout(r, 100));
    expect(broadcastCount).toBe(1);

    display.close();
    dealer.close();
  });

  it("rejects display emit", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    const display = connectClient(server.url);
    await new Promise<void>((resolve) => display.on("connect", () => resolve()));
    display.emit("message", { op: "join", code, role: "display" });
    await waitForMessage(display, (m) => m.op === "joined");

    display.emit("message", {
      op: "event",
      clientId: "x1",
      event: resultRecordedEvent(1, "r1"),
    });

    const reject = await waitForMessage(display, (m) => m.op === "reject");
    expect(reject.reason).toBeTruthy();

    display.close();
    dealer.close();
  });

  it("returns BAD_TOKEN for wrong dealer token", async () => {
    const server = await boot();
    const { code } = await createTableViaRest(server.url);

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: "bad-token" });

    const err = await waitForMessage(dealer, (m) => m.op === "error");
    expect(err.code).toBe("BAD_TOKEN");

    dealer.close();
  });

  it("returns DEALER_ACTIVE for second dealer without takeover", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);

    const dealer1 = connectClient(server.url);
    await new Promise<void>((resolve) => dealer1.on("connect", () => resolve()));
    dealer1.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer1, (m) => m.op === "joined");

    const dealer2 = connectClient(server.url);
    await new Promise<void>((resolve) => dealer2.on("connect", () => resolve()));
    dealer2.emit("message", { op: "join", code, role: "dealer", token: dealerToken });

    const err = await waitForMessage(dealer2, (m) => m.op === "error");
    expect(err.code).toBe("DEALER_ACTIVE");

    dealer1.close();
    dealer2.close();
  });

  it("demotes first dealer on takeover and rejects their next emit", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);

    const dealer1 = connectClient(server.url);
    await new Promise<void>((resolve) => dealer1.on("connect", () => resolve()));
    dealer1.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer1, (m) => m.op === "joined");

    const demotedPromise = waitForMessage(dealer1, (m) => m.op === "demoted");

    const dealer2 = connectClient(server.url);
    await new Promise<void>((resolve) => dealer2.on("connect", () => resolve()));
    dealer2.emit("message", {
      op: "join",
      code,
      role: "dealer",
      token: dealerToken,
      takeover: true,
    });
    await waitForMessage(dealer2, (m) => m.op === "joined");

    const demoted = await demotedPromise;
    expect(demoted.op).toBe("demoted");

    dealer1.emit("message", {
      op: "event",
      clientId: "d1",
      event: resultRecordedEvent(1, "r1"),
    });
    const reject = await waitForMessage(dealer1, (m) => m.op === "reject");
    expect(reject.reason).toBe("demoted");

    dealer1.close();
    dealer2.close();
  });

  it("returns delta on sinceSeq join and snapshot when gap", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    dealer.emit("message", {
      op: "event",
      clientId: "e1",
      event: resultRecordedEvent(1, "r1"),
    });
    await waitForMessage(dealer, (m) => m.op === "ack");

    const displayDelta = connectClient(server.url);
    await new Promise<void>((resolve) => displayDelta.on("connect", () => resolve()));
    displayDelta.emit("message", { op: "join", code, role: "display", sinceSeq: 1 });
    const joinedDelta = await waitForMessage<JoinedMessage>(displayDelta, (m) => m.op === "joined");
    expect(joinedDelta.events?.length).toBe(1);
    expect(joinedDelta.events?.[0]?.seq).toBe(2);
    expect(joinedDelta.snapshot).toBeUndefined();

    const displaySnap = connectClient(server.url);
    await new Promise<void>((resolve) => displaySnap.on("connect", () => resolve()));
    displaySnap.emit("message", { op: "join", code, role: "display", sinceSeq: 0 });
    const joinedSnap = await waitForMessage<JoinedMessage>(displaySnap, (m) => m.op === "joined");
    expect(joinedSnap.snapshot?.length).toBe(2);

    displayDelta.close();
    displaySnap.close();
    dealer.close();
  });

  it("rejects emits after SESSION_ENDED", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    dealer.emit("message", { op: "event", clientId: "end", event: { type: "SESSION_ENDED" } });
    await waitForMessage(dealer, (m) => m.op === "ack");

    dealer.emit("message", {
      op: "event",
      clientId: "after",
      event: resultRecordedEvent(1, "r1"),
    });
    const reject = await waitForMessage(dealer, (m) => m.op === "reject");
    expect(reject.reason).toBe("SESSION_ENDED");

    dealer.close();
  });

  it("creates a craps table via POST /tables", async () => {
    const server = await boot();
    const response = await fetch(`${server.url}/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "craps",
        participation: { playerMode: "off", bank: "none", outcomeSource: "physical" },
      }),
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as { code: string };
    expect(body.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(getModule("craps")).not.toBeNull();
    expect(resolveRules("craps")).toEqual(expect.objectContaining({ maxOdds: "3-4-5x" }));
  });

  it("rate limits the 6th table create per minute", async () => {
    const server = await boot();
    const body = {
      game: "baccarat",
      participation: { playerMode: "off", bank: "none", outcomeSource: "physical" },
    };

    for (let i = 0; i < 5; i++) {
      const response = await fetch(`${server.url}/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(201);
    }

    const blocked = await fetch(`${server.url}/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(blocked.status).toBe(429);
  });

  it("export requires valid dealer token", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);

    const unauthorized = await fetch(`${server.url}/tables/${code}/export?series=1`);
    expect(unauthorized.status).toBe(401);

    const bad = await fetch(`${server.url}/tables/${code}/export?series=1`, {
      headers: { Authorization: "Bearer wrong" },
    });
    expect(bad.status).toBe(401);

    const ok = await fetch(`${server.url}/tables/${code}/export?series=1`, {
      headers: { Authorization: `Bearer ${dealerToken}` },
    });
    expect(ok.status).toBe(200);
    const text = await ok.text();
    expect(text).toContain("#casino-lord v3");
  });
});

describe("sqlite restart", () => {
  it("reopens with identical composed state", async () => {
    const sqlitePath = `/tmp/casino-lord-restart-${Date.now()}.db`;
    const server1 = await startTestServer({ persist: "sqlite", sqlitePath });
    const { code, dealerToken } = await createTableViaRest(server1.url);

    const dealer = connectClient(server1.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    dealer.emit("message", {
      op: "event",
      clientId: "e1",
      event: resultRecordedEvent(1, "r1"),
    });
    await waitForMessage(dealer, (m) => m.op === "ack");
    dealer.close();

    const table1 = server1.registry.get(code)!;
    const state1 = stableStringify(table1.getComposed());
    await server1.close();

    const server2 = await startTestServer({ persist: "sqlite", sqlitePath });
    servers.push(server2);

    const table2 = server2.registry.get(code)!;
    const state2 = stableStringify(table2.getComposed());
    expect(state2).toBe(state1);

    const module = getModule("baccarat")!;
    const replayState = stableStringify(
      replay([...table2.allEvents], module, resolveRules("baccarat"), { code }),
    );
    expect(replayState).toBe(state1);
  });
});
