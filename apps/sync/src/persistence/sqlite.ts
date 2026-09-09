import Database from "better-sqlite3";
import type { GameId, Participation, TableEvent } from "@casino-lord/core";
import type { PlayerRow, TableRepository, TableRow } from "./repository.js";

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
    CREATE TABLE IF NOT EXISTS players (
      code TEXT NOT NULL,
      playerId TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      tokenHash TEXT NOT NULL,
      joinedAt TEXT NOT NULL,
      pending INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (code, playerId)
    );
    CREATE INDEX IF NOT EXISTS idx_players_token ON players (code, tokenHash);
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

  const insertPlayer = db.prepare(`
    INSERT INTO players (code, playerId, name, color, tokenHash, joinedAt, pending)
    VALUES (@code, @playerId, @name, @color, @tokenHash, @joinedAt, @pending)
  `);

  const getPlayerStmt = db.prepare(`
    SELECT * FROM players WHERE code = ? AND playerId = ?
  `);

  const getPlayersByCodeStmt = db.prepare(`SELECT * FROM players WHERE code = ?`);

  const findPlayerByTokenStmt = db.prepare(`
    SELECT * FROM players WHERE code = ? AND tokenHash = ?
  `);

  const updatePlayerTokenStmt = db.prepare(`
    UPDATE players SET tokenHash = @tokenHash WHERE code = @code AND playerId = @playerId
  `);

  const setPlayerPendingStmt = db.prepare(`
    UPDATE players SET pending = @pending WHERE code = @code AND playerId = @playerId
  `);

  const deletePlayerStmt = db.prepare(`DELETE FROM players WHERE code = ? AND playerId = ?`);

  const deletePlayersByCodeStmt = db.prepare(`DELETE FROM players WHERE code = ?`);

  function playerFromRecord(record: Record<string, unknown>): PlayerRow {
    return {
      code: String(record.code),
      playerId: String(record.playerId),
      name: String(record.name),
      color: String(record.color),
      tokenHash: String(record.tokenHash),
      joinedAt: String(record.joinedAt),
      pending: Number(record.pending) === 1,
    };
  }

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
      deletePlayersByCodeStmt.run(code);
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

    savePlayer(row: PlayerRow): void {
      insertPlayer.run({
        code: row.code,
        playerId: row.playerId,
        name: row.name,
        color: row.color,
        tokenHash: row.tokenHash,
        joinedAt: row.joinedAt,
        pending: row.pending ? 1 : 0,
      });
    },

    getPlayer(code: string, playerId: string): PlayerRow | null {
      const record = getPlayerStmt.get(code, playerId) as Record<string, unknown> | undefined;
      return record ? playerFromRecord(record) : null;
    },

    getPlayersByCode(code: string): PlayerRow[] {
      const records = getPlayersByCodeStmt.all(code) as Record<string, unknown>[];
      return records.map(playerFromRecord);
    },

    findPlayerByTokenHash(code: string, tokenHash: string): PlayerRow | null {
      const record = findPlayerByTokenStmt.get(code, tokenHash) as
        Record<string, unknown> | undefined;
      return record ? playerFromRecord(record) : null;
    },

    updatePlayerToken(code: string, playerId: string, tokenHash: string): void {
      updatePlayerTokenStmt.run({ code, playerId, tokenHash });
    },

    setPlayerPending(code: string, playerId: string, pending: boolean): void {
      setPlayerPendingStmt.run({ code, playerId, pending: pending ? 1 : 0 });
    },

    deletePlayer(code: string, playerId: string): void {
      deletePlayerStmt.run(code, playerId);
    },

    deletePlayersByCode(code: string): void {
      deletePlayersByCodeStmt.run(code);
    },
  };
}
