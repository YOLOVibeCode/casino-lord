import type { TableEvent } from "@casino-lord/core";
import type { PlayerRow, TableRepository, TableRow } from "./repository.js";

export function createMemoryRepository(): TableRepository {
  const tables = new Map<string, TableRow>();
  const events = new Map<string, TableEvent[]>();
  const players = new Map<string, PlayerRow>();
  const virtualSeeds = new Map<string, Buffer>();

  function virtualSeedKey(code: string, seriesId: string): string {
    return `${code}:${seriesId}`;
  }

  function playerKey(code: string, playerId: string): string {
    return `${code}:${playerId}`;
  }

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
      for (const key of [...players.keys()]) {
        if (key.startsWith(`${code}:`)) {
          players.delete(key);
        }
      }
      for (const key of [...virtualSeeds.keys()]) {
        if (key.startsWith(`${code}:`)) {
          virtualSeeds.delete(key);
        }
      }
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
          for (const key of [...players.keys()]) {
            if (key.startsWith(`${code}:`)) {
              players.delete(key);
            }
          }
          purged += 1;
        }
      }
      return purged;
    },

    hasCode(code: string): boolean {
      return tables.has(code);
    },

    savePlayer(row: PlayerRow): void {
      players.set(playerKey(row.code, row.playerId), row);
    },

    getPlayer(code: string, playerId: string): PlayerRow | null {
      return players.get(playerKey(code, playerId)) ?? null;
    },

    getPlayersByCode(code: string): PlayerRow[] {
      return [...players.values()].filter((p) => p.code === code);
    },

    findPlayerByTokenHash(code: string, tokenHash: string): PlayerRow | null {
      for (const row of players.values()) {
        if (row.code === code && row.tokenHash === tokenHash) {
          return row;
        }
      }
      return null;
    },

    updatePlayerToken(code: string, playerId: string, tokenHash: string): void {
      const row = players.get(playerKey(code, playerId));
      if (row) {
        players.set(playerKey(code, playerId), { ...row, tokenHash });
      }
    },

    setPlayerPending(code: string, playerId: string, pending: boolean): void {
      const row = players.get(playerKey(code, playerId));
      if (row) {
        players.set(playerKey(code, playerId), { ...row, pending });
      }
    },

    deletePlayer(code: string, playerId: string): void {
      players.delete(playerKey(code, playerId));
    },

    deletePlayersByCode(code: string): void {
      for (const key of [...players.keys()]) {
        if (key.startsWith(`${code}:`)) {
          players.delete(key);
        }
      }
    },

    saveVirtualSeed(code: string, seriesId: string, blob: Buffer): void {
      virtualSeeds.set(virtualSeedKey(code, seriesId), blob);
    },

    getVirtualSeed(code: string, seriesId: string): Buffer | null {
      return virtualSeeds.get(virtualSeedKey(code, seriesId)) ?? null;
    },

    deleteVirtualSeeds(code: string): void {
      for (const key of [...virtualSeeds.keys()]) {
        if (key.startsWith(`${code}:`)) {
          virtualSeeds.delete(key);
        }
      }
    },
  };
}
