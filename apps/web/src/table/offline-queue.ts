import { openDb } from "./persistence.js";

const OFFLINE_STORE = "offline-queue";

export interface QueuedEvent {
  clientId: string;
  event: Record<string, unknown> & { type: string };
  enqueuedAt: string;
}

interface QueueRecord {
  code: string;
  items: QueuedEvent[];
}

export async function enqueueOfflineEvent(
  code: string,
  item: { clientId: string; event: Record<string, unknown> & { type: string } },
): Promise<void> {
  const db = await openDb();
  const existing = await readQueue(db, code);
  const record: QueueRecord = {
    code,
    items: [...existing, { ...item, enqueuedAt: new Date().toISOString() }],
  };
  await writeQueue(db, record);
}

export async function peekOfflineQueue(code: string): Promise<QueuedEvent[]> {
  const db = await openDb();
  return readQueue(db, code);
}

export async function shiftOfflineQueue(code: string): Promise<QueuedEvent | null> {
  const db = await openDb();
  const items = await readQueue(db, code);
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  await writeQueue(db, { code, items: rest });
  return first ?? null;
}

export async function clearOfflineQueue(code: string): Promise<void> {
  const db = await openDb();
  await writeQueue(db, { code, items: [] });
}

function readQueue(db: IDBDatabase, code: string): Promise<QueuedEvent[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readonly");
    const req = tx.objectStore(OFFLINE_STORE).get(code);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result as QueueRecord | undefined;
      resolve(row?.items ?? []);
    };
  });
}

function writeQueue(db: IDBDatabase, record: QueueRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readwrite");
    const req = tx.objectStore(OFFLINE_STORE).put(record);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}
