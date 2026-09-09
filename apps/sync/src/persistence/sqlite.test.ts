import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createSqliteRepository } from "./sqlite.js";

describe("createSqliteRepository", () => {
  it("persists tables and events with unique (code, seq)", () => {
    const dbPath = join(tmpdir(), `casino-lord-sqlite-${Date.now()}.db`);
    const repo = createSqliteRepository(dbPath);

    repo.createTable({
      code: "ABC123",
      game: "baccarat",
      participation: { playerMode: "off", bank: "none", outcomeSource: "physical" },
      dealerTokenHash: "hash",
      createdAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
    });

    repo.saveEvent("ABC123", {
      seq: 1,
      at: "2026-01-01T00:00:00.000Z",
      type: "TABLE_CREATED",
      game: "baccarat",
      participation: { playerMode: "off", bank: "none", outcomeSource: "physical" },
      settings: {} as never,
    });

    expect(repo.loadEvents("ABC123")).toHaveLength(1);
    expect(repo.hasCode("ABC123")).toBe(true);

    rmSync(dbPath, { force: true });
  });
});
