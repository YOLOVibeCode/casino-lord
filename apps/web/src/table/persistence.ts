import type { GameId, TableEvent } from "@casino-lord/core";
import { isPersistedEvent } from "@casino-lord/core";

const DB_NAME = "casino-lord";
const DB_VERSION = 2;
const STORE = "tables";
const OFFLINE_STORE = "offline-queue";

export interface StoredTable {
  code: string;
  game: GameId;
  events: TableEvent[];
  updatedAt: string;
}

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "code" });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
        db.createObjectStore(OFFLINE_STORE, { keyPath: "code" });
      }
    };
  });
}

export async function loadTable(code: string): Promise<StoredTable | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(code);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve((req.result as StoredTable | undefined) ?? null);
  });
}

export async function saveTableEvents(
  code: string,
  game: GameId,
  events: TableEvent[],
): Promise<void> {
  const persisted = events.filter(isPersistedEvent);
  const record: StoredTable = {
    code,
    game,
    events: persisted,
    updatedAt: new Date().toISOString(),
  };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(record);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function listRecentTables(limit = 10): Promise<StoredTable[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const rows = (req.result as StoredTable[]).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
      resolve(rows.slice(0, limit));
    };
  });
}

export function persistedEventsOnly(events: TableEvent[]): TableEvent[] {
  return events.filter(isPersistedEvent);
}
