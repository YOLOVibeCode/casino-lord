import type { TableStore } from "../table/store.js";
import { isSyncStore } from "../table/sync-store-types.js";
import { useStore } from "../hooks/use-store.js";
import "./player-shell.css";

export interface PlayerShellProps {
  store: TableStore;
  playerName: string;
}

export function PlayerShell({ store, playerName }: PlayerShellProps) {
  useStore(store);
  const composed = store.getComposed();
  const bankroll =
    isSyncStore(store) && store.getPlayerId()
      ? (composed.platform.bankrolls[store.getPlayerId()!] ?? 0)
      : 0;
  const connection = isSyncStore(store) ? store.getConnectionState() : "offline";
  const dotClass =
    connection === "connected"
      ? "player-shell__dot player-shell__dot--on"
      : "player-shell__dot player-shell__dot--off";

  return (
    <div class="player-shell" data-testid="player-shell">
      <header class="player-shell__header">
        <span class={dotClass} data-testid="connection-dot" />
        <span class="player-shell__name">{playerName}</span>
        <span class="player-shell__bank">⛁ {bankroll}</span>
        <span class="player-shell__code">{store.code}</span>
      </header>
      <main class="player-shell__main">
        <p class="player-shell__placeholder">Bets will appear here</p>
      </main>
    </div>
  );
}
