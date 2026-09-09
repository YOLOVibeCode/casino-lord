import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { createTableViaRest, startTestServer } from "../../../sync/src/test-helpers/server.js";
import { minimalBaccaratResult } from "../../../sync/src/test-helpers/baccarat-result.js";
import { asUntypedModule } from "./module-types.js";
import { composedStateFingerprint } from "./store.js";
import {
  createSyncedTableStore,
  deliverMessageForTest,
  disconnectSyncStoreForTest,
  getSyncSocketForTest,
  reconnectSyncStoreForTest,
  waitForSyncReady,
} from "./synced-store.js";
import type { SyncStore } from "./sync-store-types.js";

const module = asUntypedModule(baccaratModule);
const rules = baccaratModule.defaultRules;

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

async function openDealer(url: string, code: string, token: string): Promise<SyncStore> {
  const store = createSyncedTableStore({
    code,
    role: "dealer",
    token,
    syncUrl: url,
    module,
    rules,
  });
  await waitForSyncReady(store);
  return store;
}

async function openDisplay(url: string, code: string): Promise<SyncStore> {
  const store = createSyncedTableStore({
    code,
    role: "display",
    syncUrl: url,
    module,
    rules,
  });
  await waitForSyncReady(store);
  return store;
}

async function waitForFingerprint(
  display: SyncStore,
  expected: string,
  attempts = 20,
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    if (composedStateFingerprint(display) === expected) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  expect(composedStateFingerprint(display)).toBe(expected);
}

describe("synced store", () => {
  it("dealer records 3 results and display reaches same fingerprint", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);

    const dealer = await openDealer(server.url, code, dealerToken);
    const display = await openDisplay(server.url, code);

    for (let i = 0; i < 3; i++) {
      dealer.record(minimalBaccaratResult(), { quick: false });
      await new Promise((r) => setTimeout(r, 150));
    }

    await waitForFingerprint(display, composedStateFingerprint(dealer));

    dealer.destroy();
    display.destroy();
  });

  it("reject rolls back optimistic event", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);
    const dealer = await openDealer(server.url, code, dealerToken);
    const display = await openDisplay(server.url, code);

    dealer.endSession();
    for (let i = 0; i < 30; i++) {
      if (display.events.some((e) => e.type === "SESSION_ENDED")) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(display.events.some((e) => e.type === "SESSION_ENDED")).toBe(true);

    dealer.record(minimalBaccaratResult(), { quick: false });
    await new Promise((r) => setTimeout(r, 400));

    expect(dealer.getRejectReason()).toBe("SESSION_ENDED");
    expect(dealer.events.some((e) => e.type === "RESULT_RECORDED")).toBe(false);

    dealer.destroy();
    display.destroy();
  });

  it("offline queue flushes in order on reconnect", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);
    const dealer = await openDealer(server.url, code, dealerToken);
    const display = await openDisplay(server.url, code);

    disconnectSyncStoreForTest(dealer);
    await new Promise((r) => setTimeout(r, 150));

    dealer.record(minimalBaccaratResult(), { quick: false });
    dealer.record(minimalBaccaratResult(), { quick: false });
    await new Promise((r) => setTimeout(r, 100));

    reconnectSyncStoreForTest(dealer);
    await waitForSyncReady(dealer);
    await new Promise((r) => setTimeout(r, 400));

    await waitForFingerprint(display, composedStateFingerprint(dealer));

    dealer.destroy();
    display.destroy();
  });

  it("resyncs on seq gap", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);
    const dealer = await openDealer(server.url, code, dealerToken);
    const display = await openDisplay(server.url, code);

    dealer.record(minimalBaccaratResult(), { quick: false });
    await waitForFingerprint(display, composedStateFingerprint(dealer));

    const latestSeq = display.events.reduce((max, e) => Math.max(max, e.seq), 0);
    const socket = getSyncSocketForTest(display);
    expect(socket).toBeTruthy();

    let resyncCount = 0;
    const originalEmit = socket!.emit.bind(socket);
    socket!.emit = ((event: string, ...args: unknown[]) => {
      const msg = args[0] as { op?: string } | undefined;
      if (event === "message" && msg?.op === "resync") {
        resyncCount += 1;
      }
      return originalEmit(event, ...args);
    }) as typeof socket.emit;

    deliverMessageForTest(display, {
      op: "event",
      event: {
        type: "RESULT_RECORDED",
        seq: latestSeq + 2,
        at: "2026-01-01T00:00:10.000Z",
        result: {
          id: "gap-gap",
          index: 99,
          recordedAt: "2026-01-01T00:00:10.000Z",
          quick: false,
          source: "physical",
          by: "dealer",
          data: minimalBaccaratResult(),
        },
      },
    });

    await new Promise((r) => setTimeout(r, 300));
    expect(resyncCount).toBeGreaterThan(0);

    dealer.record(minimalBaccaratResult(), { quick: false });
    await waitForFingerprint(display, composedStateFingerprint(dealer));

    dealer.destroy();
    display.destroy();
  });

  it("reopening a table with a populated local log does not duplicate events", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);
    const dealer = await openDealer(server.url, code, dealerToken);
    const first = await openDisplay(server.url, code);

    dealer.record(minimalBaccaratResult(), { quick: false });
    dealer.record(minimalBaccaratResult(), { quick: false });
    await waitForFingerprint(first, composedStateFingerprint(dealer));
    // Let the local IndexedDB log settle before simulating a reload.
    await new Promise((r) => setTimeout(r, 100));
    first.destroy();

    const storedLatestSeq = first.events.reduce((max, e) => Math.max(max, e.seq), 0);
    expect(storedLatestSeq).toBeGreaterThan(0);

    const reopened = createSyncedTableStore({
      code,
      role: "display",
      syncUrl: server.url,
      module,
      rules,
    });
    const socket = getSyncSocketForTest(reopened)!;
    const joins: Array<{ sinceSeq?: number }> = [];
    const originalEmit = socket.emit.bind(socket);
    socket.emit = ((event: string, ...args: unknown[]) => {
      const msg = args[0] as { op?: string; sinceSeq?: number } | undefined;
      if (event === "message" && msg?.op === "join") joins.push(msg);
      return originalEmit(event, ...args);
    }) as typeof socket.emit;
    await waitForSyncReady(reopened);

    // The local log must be loaded before the first join, so it resumes from the stored seq.
    expect(joins[0]?.sinceSeq).toBe(storedLatestSeq);

    await waitForFingerprint(reopened, composedStateFingerprint(dealer));
    const seqs = reopened.events.map((e) => e.seq);
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));

    dealer.destroy();
    reopened.destroy();
  });

  it("takeover demotes the first dealer", async () => {
    const server = await boot();
    const { code, dealerToken } = await createTableViaRest(server.url);

    const dealer1 = await openDealer(server.url, code, dealerToken);
    const dealer2 = createSyncedTableStore({
      code,
      role: "dealer",
      token: dealerToken,
      syncUrl: server.url,
      module,
      rules,
      takeover: true,
    });
    await waitForSyncReady(dealer2);

    await new Promise((r) => setTimeout(r, 300));
    expect(dealer1.isReadOnly()).toBe(true);

    dealer1.destroy();
    dealer2.destroy();
  });
});
