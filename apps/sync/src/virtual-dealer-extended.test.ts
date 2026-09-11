import { createSeededRng, hexToBytes, PLAYER_COLORS, type TableEvent } from "@casino-lord/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  baccaratVirtualStep,
  DEFAULT_BACCARAT_RULES,
  initialState,
} from "@casino-lord/game-baccarat";
import { crapsModule, DEFAULT_CRAPS_RULES } from "@casino-lord/game-craps";
import { DEFAULT_ROULETTE_RULES, rouletteModule } from "@casino-lord/game-roulette";
import {
  connectClient,
  createTableViaRest,
  joinPlayerViaRest,
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

async function boot() {
  const server = await startTestServer({ enableVirtual: true });
  servers.push(server);
  return server;
}

describe("virtual dealer extended", () => {
  it("virtual roulette trigger paces RESULT_RECORDED after wheelSpinMs", async () => {
    const server = await boot();
    const wheelSpinMs = 80;
    const { code, dealerToken } = await createTableViaRest(server.url, {
      game: "roulette",
      participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
      settings: { virtual: { wheelSpinMs, revealDelayMs: 50 } },
    });

    const display = connectClient(server.url);
    await new Promise<void>((resolve) => display.on("connect", () => resolve()));
    display.emit("message", { op: "join", code, role: "display" });
    await waitForMessage(display, (m) => m.op === "joined");

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    const times: Array<{ type: string; at: number }> = [];
    display.on("message", (msg) => {
      if (msg.op === "event") {
        times.push({ type: msg.event.type, at: Date.now() });
      }
    });

    dealer.emit("message", { op: "virtual", kind: "trigger", clientId: "spin1" });
    await waitForMessage(dealer, (m) => m.op === "ack" && m.clientId === "spin1");

    const live = times.find((t) => t.type === "LIVE_INPUT");
    const result = times.find((t) => t.type === "RESULT_RECORDED");
    expect(live).toBeDefined();
    expect(result).toBeDefined();
    expect(result!.at - live!.at).toBeGreaterThanOrEqual(wheelSpinMs - 30);

    const table = server.registry.get(code)!;
    expect(table.allEvents.some((e) => e.type === "VIRTUAL_PENDING")).toBe(false);

    display.close();
    dealer.close();
  });

  it("virtual craps trigger paces RESULT_RECORDED after diceTumbleMs", async () => {
    const server = await boot();
    const diceTumbleMs = 80;
    const { code, dealerToken } = await createTableViaRest(server.url, {
      game: "craps",
      participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
      settings: { virtual: { diceTumbleMs, revealDelayMs: 50 } },
    });

    const display = connectClient(server.url);
    await new Promise<void>((resolve) => display.on("connect", () => resolve()));
    display.emit("message", { op: "join", code, role: "display" });
    await waitForMessage(display, (m) => m.op === "joined");

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    const times: Array<{ type: string; at: number }> = [];
    display.on("message", (msg) => {
      if (msg.op === "event") {
        times.push({ type: msg.event.type, at: Date.now() });
      }
    });

    dealer.emit("message", { op: "virtual", kind: "trigger", clientId: "roll1" });
    await waitForMessage(dealer, (m) => m.op === "ack" && m.clientId === "roll1");

    const live = times.find((t) => t.type === "LIVE_INPUT");
    const result = times.find((t) => t.type === "RESULT_RECORDED");
    expect(live).toBeDefined();
    expect(result).toBeDefined();
    expect(result!.at - live!.at).toBeGreaterThanOrEqual(diceTumbleMs - 30);

    display.close();
    dealer.close();
  });

  it("craps shooter can trigger and non-shooter is rejected", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url, {
      game: "craps",
      participation: { playerMode: "on", bank: "none", outcomeSource: "virtual" },
    });

    const shooter = await joinPlayerViaRest(server.url, code, {
      name: "Shooter",
      color: PLAYER_COLORS[0]!,
    });
    expect(shooter.pending).toBe(false);
    const other = await joinPlayerViaRest(server.url, code, {
      name: "Other",
      color: PLAYER_COLORS[1]!,
    });
    expect(other.pending).toBe(false);

    const table = server.registry.get(code)!;
    const moduleState = table.getComposed().module as { currentShooterId: string | null };
    expect(moduleState.currentShooterId).toBe(shooter.playerId);

    const shooterClient = connectClient(server.url);
    await new Promise<void>((resolve) => shooterClient.on("connect", () => resolve()));
    shooterClient.emit("message", {
      op: "join",
      code,
      role: "player",
      token: shooter.playerToken,
    });
    await waitForMessage(shooterClient, (m) => m.op === "joined");

    const otherClient = connectClient(server.url);
    await new Promise<void>((resolve) => otherClient.on("connect", () => resolve()));
    otherClient.emit("message", {
      op: "join",
      code,
      role: "player",
      token: other.playerToken,
    });
    await waitForMessage(otherClient, (m) => m.op === "joined");

    shooterClient.emit("message", { op: "virtual", kind: "trigger", clientId: "shooter-roll" });
    await waitForMessage(shooterClient, (m) => m.op === "ack" && m.clientId === "shooter-roll");

    otherClient.emit("message", { op: "virtual", kind: "trigger", clientId: "other-roll" });
    const reject = await waitForMessage(
      otherClient,
      (m) => m.op === "reject" && m.clientId === "other-roll",
    );
    expect(reject.reason).toBe("not authorized");

    shooterClient.close();
    otherClient.close();
  });

  it("autoTrigger fires on BETS_CLOSED for virtual tables only", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url, {
      game: "roulette",
      participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
      settings: {
        virtual: { autoTrigger: true, wheelSpinMs: 20, revealDelayMs: 20 },
        betting: { autoOpenDelayMs: 50, betTimerSec: 0, autoCloseOnEntry: false },
      },
    });

    const dealer = connectClient(server.url);
    await new Promise<void>((resolve) => dealer.on("connect", () => resolve()));
    dealer.emit("message", { op: "join", code, role: "dealer", token: dealerToken });
    await waitForMessage(dealer, (m) => m.op === "joined");

    dealer.emit("message", {
      op: "event",
      clientId: "bo1",
      event: { type: "BETS_OPENED", roundId: "r1" },
    });
    await waitForMessage(dealer, (m) => m.op === "ack" && m.clientId === "bo1");

    dealer.emit("message", {
      op: "event",
      clientId: "bc1",
      event: { type: "BETS_CLOSED", roundId: "r1", by: "dealer" },
    });
    await waitForMessage(dealer, (m) => m.op === "ack" && m.clientId === "bc1");

    await new Promise((r) => setTimeout(r, 200));

    const table = server.registry.get(code)!;
    const results = table.allEvents.filter((e) => e.type === "RESULT_RECORDED");
    expect(results.length).toBeGreaterThanOrEqual(1);
    const first = results[0];
    expect(first?.type).toBe("RESULT_RECORDED");
    if (first?.type === "RESULT_RECORDED") {
      expect(first.result.roundId).toBe("r1");
    }

    dealer.close();
  });

  it("appendix C replay for roulette, craps, and baccarat", () => {
    const seed = hexToBytes("010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20");

    const rouletteRules = DEFAULT_ROULETTE_RULES;
    const rouletteState = rouletteModule.initialState(rouletteRules);
    const rouletteLogged = rouletteModule.virtual!.step({
      state: rouletteState,
      rules: rouletteRules,
      rng: createSeededRng(seed),
      trigger: "spin",
    });
    const rouletteReplay = rouletteModule.virtual!.step({
      state: rouletteState,
      rules: rouletteRules,
      rng: createSeededRng(seed),
      trigger: "spin",
    });
    const r1 = rouletteLogged.events.find((e) => e.type === "RESULT_RECORDED") as
      Extract<TableEvent, { type: "RESULT_RECORDED" }> | undefined;
    const r2 = rouletteReplay.events.find((e) => e.type === "RESULT_RECORDED") as
      Extract<TableEvent, { type: "RESULT_RECORDED" }> | undefined;
    if (r1 && r2) {
      expect(r1.result.data).toEqual(r2.result.data);
    }

    const crapsRules = DEFAULT_CRAPS_RULES;
    const crapsState = crapsModule.initialState(crapsRules);
    const crapsLogged = crapsModule.virtual!.step({
      state: crapsState,
      rules: crapsRules,
      rng: createSeededRng(seed),
      trigger: "roll",
    });
    const crapsReplay = crapsModule.virtual!.step({
      state: crapsState,
      rules: crapsRules,
      rng: createSeededRng(seed),
      trigger: "roll",
    });
    const c1 = crapsLogged.events.find((e) => e.type === "RESULT_RECORDED") as
      Extract<TableEvent, { type: "RESULT_RECORDED" }> | undefined;
    const c2 = crapsReplay.events.find((e) => e.type === "RESULT_RECORDED") as
      Extract<TableEvent, { type: "RESULT_RECORDED" }> | undefined;
    if (c1 && c2) {
      expect(c1.result.data).toEqual(c2.result.data);
    }

    const baccaratLogged = baccaratVirtualStep({
      state: initialState(DEFAULT_BACCARAT_RULES),
      rules: DEFAULT_BACCARAT_RULES,
      rng: createSeededRng(seed),
      trigger: "deal",
      session: null,
      seriesId: "s1",
    });
    const baccaratReplay = baccaratVirtualStep({
      state: initialState(DEFAULT_BACCARAT_RULES),
      rules: DEFAULT_BACCARAT_RULES,
      rng: createSeededRng(seed),
      trigger: "deal",
      session: null,
      seriesId: "s1",
    });
    const b1 = baccaratLogged.events.find((e) => e.type === "RESULT_RECORDED") as
      Extract<TableEvent, { type: "RESULT_RECORDED" }> | undefined;
    const b2 = baccaratReplay.events.find((e) => e.type === "RESULT_RECORDED") as
      Extract<TableEvent, { type: "RESULT_RECORDED" }> | undefined;
    if (b1 && b2) {
      expect(b1.result.data).toEqual(b2.result.data);
    }
  });
});
