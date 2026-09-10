import type { GameId, Participation, TableEvent } from "@casino-lord/core";

export interface TableRow {
  code: string;
  game: GameId;
  participation: Participation;
  dealerTokenHash: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface PlayerRow {
  code: string;
  playerId: string;
  name: string;
  color: string;
  tokenHash: string;
  joinedAt: string;
  pending: boolean;
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
  savePlayer(row: PlayerRow): void;
  getPlayer(code: string, playerId: string): PlayerRow | null;
  getPlayersByCode(code: string): PlayerRow[];
  findPlayerByTokenHash(code: string, tokenHash: string): PlayerRow | null;
  updatePlayerToken(code: string, playerId: string, tokenHash: string): void;
  setPlayerPending(code: string, playerId: string, pending: boolean): void;
  deletePlayer(code: string, playerId: string): void;
  deletePlayersByCode(code: string): void;
  saveVirtualSeed(code: string, seriesId: string, blob: Buffer): void;
  getVirtualSeed(code: string, seriesId: string): Buffer | null;
  deleteVirtualSeeds(code: string): void;
}
