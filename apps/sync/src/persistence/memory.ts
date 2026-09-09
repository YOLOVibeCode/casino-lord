import type { TableEvent } from "@casino-lord/core";
import type { TableRepository, TableRow } from "./repository.js";

export function createMemoryRepository(): TableRepository {
  const tables = new Map<string, TableRow>();
  const events = new Map<string, TableEvent[]>();

  return {
    createTable(row: TableRow): void {
      if (tables.has(row.code)) {
        throw new Error(`table already exists: ${row.code}`);
      }
      tables.set(row.code, row);
      events.set(row.code, []);
    },

    getTable(code: string): TableRow | null {
      return tables.get(code) ?? null;
    },

    listTables(): TableRow[] {
      return [...tables.values()];
    },

    deleteTable(code: string): void {
      tables.delete(code);
      events.delete(code);
    },

    saveEvent(code: string, event: TableEvent): void {
      const list = events.get(code);
      if (!list) {
        throw new Error(`table not found: ${code}`);
      }
      list.push(event);
    },

    loadEvents(code: string): TableEvent[] {
      return [...(events.get(code) ?? [])];
    },

    updateLastSeen(code: string, at: string): void {
      const row = tables.get(code);
      if (row) {
        tables.set(code, { ...row, lastSeenAt: at });
      }
    },

    purgeOlderThan(cutoffIso: string): number {
      let purged = 0;
      for (const [code, row] of tables) {
        if (row.lastSeenAt < cutoffIso) {
          tables.delete(code);
          events.delete(code);
          purged += 1;
        }
      }
      return purged;
    },

    hasCode(code: string): boolean {
      return tables.has(code);
    },
  };
}
