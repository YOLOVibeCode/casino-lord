import Database from "better-sqlite3";
import { verifyCommit, hexToBytes } from "@casino-lord/core";
import { afterEach, describe, expect, it } from "vitest";
import { createTableViaRest, startTestServer } from "./test-helpers/server.js";

const servers: Array<Awaited<ReturnType<typeof startTestServer>>> = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) {
      await server.close();
    }
  }
});

async function boot(options?: Parameters<typeof startTestServer>[0]) {
  const server = await startTestServer(options);
  servers.push(server);
  return server;
}

describe("virtual seed persistence", () => {
  it("stores encrypted blob when SEED_KEY is set", async () => {
    const sqlitePath = `/tmp/casino-lord-seed-${Date.now()}.db`;
    const server = await boot({ persist: "sqlite", sqlitePath, seedKey: "test-secret-key" });
    const { code } = await createTableViaRest(server.url, {
      game: "baccarat",
      participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
    });

    const table = server.registry.get(code)!;
    const start = table.allEvents.find((e) => e.type === "SERIES_STARTED");
    expect(start?.type).toBe("SERIES_STARTED");

    const dealer = server.registry.getVirtualDealer(code)!;
    const seedHex = dealer.getSeedHex();
    if (start?.type !== "SERIES_STARTED") {
      throw new Error("missing SERIES_STARTED");
    }

    const db = new Database(sqlitePath);
    const row = db
      .prepare("SELECT blob FROM virtual_seeds WHERE code = ? AND seriesId = ?")
      .get(code, start.seriesId) as { blob: Buffer } | undefined;
    db.close();

    expect(row).toBeTruthy();
    expect(row!.blob.toString("hex")).not.toBe(seedHex);
  });

  it("restores virtual dealer after sqlite restart and fairness verifies after reveal", async () => {
    const sqlitePath = `/tmp/casino-lord-seed-restart-${Date.now()}.db`;
    const server1 = await boot({ persist: "sqlite", sqlitePath, seedKey: "restart-key" });
    const { code } = await createTableViaRest(server1.url, {
      game: "baccarat",
      participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
    });

    const table1 = server1.registry.get(code)!;
    const start = table1.allEvents.find((e) => e.type === "SERIES_STARTED");
    expect(start?.type).toBe("SERIES_STARTED");

    const dealer1 = server1.registry.getVirtualDealer(code)!;
    const endEvent = dealer1.endSeriesEvent();
    const appended = table1.appendEvent(endEvent, "test-series-end", new Date().toISOString());
    if (appended.kind === "new") {
      server1.registry.persistEvent(code, appended.event);
    }

    await server1.close();
    servers.pop();

    const server2 = await boot({ persist: "sqlite", sqlitePath, seedKey: "restart-key" });
    const dealer2 = server2.registry.getVirtualDealer(code);
    expect(dealer2).not.toBeNull();

    const after = await fetch(`${server2.url}/tables/${code}/fairness?series=1`);
    const afterBody = (await after.json()) as { commit: string; seed?: string; draws: unknown[] };
    expect(afterBody.seed).toHaveLength(64);
    if (start?.type !== "SERIES_STARTED") {
      throw new Error("missing SERIES_STARTED");
    }
    expect(verifyCommit(hexToBytes(afterBody.seed!), code, start.seriesId, afterBody.commit)).toBe(
      true,
    );
  });
});
