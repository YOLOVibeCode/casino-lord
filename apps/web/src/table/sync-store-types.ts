import type { TableStore } from "./store.js";

export type ConnectionState = "connected" | "reconnecting" | "offline";

export interface PlayerPresenceEntry {
  id: string;
  connected: boolean;
}

export interface PendingPlayerEntry {
  id: string;
  name: string;
  color: string;
}

export interface SyncPresence {
  dealers: number;
  displays: number;
  players: PlayerPresenceEntry[];
}

export interface VirtualStatus {
  awaiting: "none" | "action" | "trigger";
  turnPlayerId?: string;
  turnPrompt?: string;
}

export interface VirtualPendingState {
  kind: "dice" | "shoe" | "wheel";
  untilAt: string;
}

export interface SyncStore extends TableStore {
  getConnectionState(): ConnectionState;
  getPresence(): SyncPresence;
  getVirtualStatus(): VirtualStatus | null;
  getVirtualPending(): VirtualPendingState | null;
  isReadOnly(): boolean;
  getRejectReason(): string | null;
  takeover(): void;
  destroy(): void;
  getDealerToken(): string | null;
  getPlayerId(): string | null;
  getPendingPlayers(): PendingPlayerEntry[];
  sendAdmit(playerId: string, accept: boolean): void;
}

export function isSyncStore(store: TableStore): store is SyncStore {
  return typeof (store as SyncStore).getConnectionState === "function";
}
