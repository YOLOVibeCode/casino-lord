import type { TableStore } from "./store.js";

export type ConnectionState = "connected" | "reconnecting" | "offline";

export interface SyncPresence {
  dealers: number;
  displays: number;
}

export interface SyncStore extends TableStore {
  getConnectionState(): ConnectionState;
  getPresence(): SyncPresence;
  isReadOnly(): boolean;
  getRejectReason(): string | null;
  takeover(): void;
  destroy(): void;
  getDealerToken(): string | null;
}

export function isSyncStore(store: TableStore): store is SyncStore {
  return typeof (store as SyncStore).getConnectionState === "function";
}
