import Database from "better-sqlite3";
import type { GameId, Participation, TableEvent } from "@casino-lord/core";
import type { TableRepository, TableRow } from "./repository.js";

function parseParticipation(json: string): Participation {
  return JSON.parse(json) as Participation;
}

export function createSqliteRepository(dbPath: string): TableRepository {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      code TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      participation TEXT NOT NULL,
      dealerTokenHash TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      lastSeenAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      code TEXT NOT NULL,
      seq INTEGER NOT NULL,
      json TEXT NOT NULL,
      PRIMARY KEY (code, seq)
    );
  `);

  const insertTable = db.prepare(`
    INSERT INTO tables (code, game, participation, dealerTokenHash, createdAt, lastSeenAt)
    VALUES (@code, @game, @participation, @dealerTokenHash, @createdAt, @lastSeenAt)
  `);

  const getTableStmt = db.prepare(`SELECT * FROM tables WHERE code = ?`);

  const listTablesStmt = db.prepare(`SELECT * FROM tables`);

  const deleteTableStmt = db.prepare(`DELETE FROM tables WHERE code = ?`);
  const deleteEventsStmt = db.prepare(`DELETE FROM events WHERE code = ?`);

  const insertEvent = db.prepare(`
    INSERT INTO events (code, seq, json) VALUES (@code, @seq, @json)
  `);

  const loadEventsStmt = db.prepare(`
    SELECT json FROM events WHERE code = ? ORDER BY seq ASC
  `);

  const updateLastSeenStmt = db.prepare(`
    UPDATE tables SET lastSeenAt = @lastSeenAt WHERE code = @code
  `);

  const purgeTablesStmt = db.prepare(`DELETE FROM tables WHERE lastSeenAt < ?`);
  const purgeEventsStmt = db.prepare(`
    DELETE FROM events WHERE code NOT IN (SELECT code FROM tables)
  `);

  const hasCodeStmt = db.prepare(`SELECT 1 FROM tables WHERE code = ? LIMIT 1`);

  function rowFromRecord(record: Record<string, unknown>): TableRow {
    return {
      code: String(record.code),
      game: String(record.game) as GameId,
      participation: parseParticipation(String(record.participation)),
      dealerTokenHash: String(record.dealerTokenHash),
      createdAt: String(record.createdAt),
      lastSeenAt: String(record.lastSeenAt),
    };
  }

  return {
    createTable(row: TableRow): void {
      insertTable.run({
        code: row.code,
        game: row.game,
        participation: JSON.stringify(row.participation),
        dealerTokenHash: row.dealerTokenHash,
        createdAt: row.createdAt,
        lastSeenAt: row.lastSeenAt,
      });
    },

    getTable(code: string): TableRow | null {
      const record = getTableStmt.get(code) as Record<string, unknown> | undefined;
      return record ? rowFromRecord(record) : null;
    },

    listTables(): TableRow[] {
      const records = listTablesStmt.all() as Record<string, unknown>[];
      return records.map(rowFromRecord);
    },

    deleteTable(code: string): void {
      deleteEventsStmt.run(code);
      deleteTableStmt.run(code);
    },

    saveEvent(code: string, event: TableEvent): void {
      insertEvent.run({
        code,
        seq: event.seq,
        json: JSON.stringify(event),
      });
    },

    loadEvents(code: string): TableEvent[] {
      const rows = loadEventsStmt.all(code) as Array<{ json: string }>;
      return rows.map((r) => JSON.parse(r.json) as TableEvent);
    },

    updateLastSeen(code: string, at: string): void {
      updateLastSeenStmt.run({ code, lastSeenAt: at });
    },

    purgeOlderThan(cutoffIso: string): number {
      const result = purgeTablesStmt.run(cutoffIso);
      purgeEventsStmt.run();
      return result.changes;
    },

    hasCode(code: string): boolean {
      return hasCodeStmt.get(code) !== undefined;
    },
  };
}
