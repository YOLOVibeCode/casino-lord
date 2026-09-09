import type { GameId, Participation, TableEvent } from "@casino-lord/core";

export interface TableRow {
  code: string;
  game: GameId;
  participation: Participation;
  dealerTokenHash: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface TableRepository {
  createTable(row: TableRow): void;
  getTable(code: string): TableRow | null;
  listTables(): TableRow[];
  deleteTable(code: string): void;
  saveEvent(code: string, event: TableEvent): void;
  loadEvents(code: string): TableEvent[];
  updateLastSeen(code: string, at: string): void;
  purgeOlderThan(cutoffIso: string): number;
  hasCode(code: string): boolean;
}
