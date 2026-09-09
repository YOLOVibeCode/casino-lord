import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { createTableViaRest, startTestServer } from "../../../sync/src/test-helpers/server.js";
import { minimalBaccaratResult } from "../../../sync/src/test-helpers/baccarat-result.js";
import { asUntypedModule } from "./module-types.js";
import { composedStateFingerprint } from "./store.js";
import {
  createSyncedTableStore,
  disconnectSyncStoreForTest,
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
