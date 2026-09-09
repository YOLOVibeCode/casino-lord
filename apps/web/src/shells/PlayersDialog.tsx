import { useState } from "preact/hooks";
import { getBankroll } from "@casino-lord/core";
import { reissuePlayerToken } from "../sync/api.js";
import { getSyncBaseUrl } from "../sync/config.js";
import { qrDataUrl } from "../sync/qr.js";
import { tableUrl } from "../sync/urls.js";
import type { SyncStore } from "../table/sync-store-types.js";
import "./players-dialog.css";

export interface PlayersDialogProps {
  store: SyncStore;
  onClose: () => void;
}

export function PlayersDialog({ store, onClose }: PlayersDialogProps) {
  const composed = store.getComposed();
  const pending = store.getPendingPlayers();
  const players = composed.platform.players.filter((p) => p.status !== "removed");
  const joiningOpen = composed.platform.settings.players.joiningOpen;
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [reissueQr, setReissueQr] = useState("");
  const dealerToken = store.getDealerToken();

  const toggleJoining = (): void => {
    void store.emit({
      type: "SETTINGS_CHANGED",
      patch: { players: { joiningOpen: !joiningOpen } },
    });
  };

  const handleRename = (playerId: string): void => {
    const trimmed = renameValue.trim();
    if (trimmed.length < 2) return;
    void store.emit({
      type: "PLAYER_UPDATED",
      playerId,
      patch: { name: trimmed },
    });
    setRenamingId(null);
    setRenameValue("");
  };

  const handleRemove = (playerId: string): void => {
    void store.emit({ type: "PLAYER_REMOVED", playerId });
  };

  const handleReissue = async (playerId: string): Promise<void> => {
    if (!dealerToken) return;
    try {
      await reissuePlayerToken(getSyncBaseUrl(), store.code, playerId, dealerToken);
      const playUrl = tableUrl(`/play/${store.code}`);
      const qr = await qrDataUrl(playUrl);
      setReissueQr(qr);
    } catch {
      setReissueQr("");
    }
  };

  return (
    <div class="players-dialog__backdrop" data-testid="players-dialog">
      <div class="players-dialog" onClick={(e) => e.stopPropagation()}>
        <header class="players-dialog__header">
          <h2>Players</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {pending.length > 0 && (
          <section class="players-dialog__section">
            <h3>Pending approval</h3>
            {pending.map((p) => (
              <div key={p.id} class="players-dialog__pending" data-testid={`pending-${p.id}`}>
                <span class="players-dialog__dot" style={{ background: p.color }} />
                <span>{p.name}</span>
                <button
                  type="button"
                  data-testid={`approve-${p.id}`}
                  onClick={() => store.sendAdmit(p.id, true)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  data-testid={`decline-${p.id}`}
                  onClick={() => store.sendAdmit(p.id, false)}
                >
                  Decline
                </button>
              </div>
            ))}
          </section>
        )}

        <section class="players-dialog__section">
          <h3>Roster</h3>
          {players.length === 0 && pending.length === 0 && (
            <p class="players-dialog__empty">No players yet</p>
          )}
          {players.map((p) => {
            const bankroll = getBankroll(composed.platform, p.id);
            const connected = store
              .getPresence()
              .players.some((entry) => entry.id === p.id && entry.connected);
            return (
              <div key={p.id} class="players-dialog__row" data-testid={`player-row-${p.id}`}>
                <span class="players-dialog__dot" style={{ background: p.color }} />
                <span>
                  {p.name}{" "}
                  <span class="players-dialog__status">
                    {p.status === "away" ? "away" : connected ? "active" : "offline"}
                  </span>
                </span>
                <span class="players-dialog__bank">{bankroll}</span>
                {renamingId === p.id ? (
                  <>
                    <input
                      type="text"
                      value={renameValue}
                      maxLength={16}
                      onInput={(e) => setRenameValue((e.target as HTMLInputElement).value)}
                      data-testid={`rename-input-${p.id}`}
                    />
                    <button type="button" onClick={() => handleRename(p.id)}>
                      Save
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    data-testid={`rename-${p.id}`}
                    onClick={() => {
                      setRenamingId(p.id);
                      setRenameValue(p.name);
                    }}
                  >
                    Rename
                  </button>
                )}
                <button
                  type="button"
                  data-testid={`remove-${p.id}`}
                  onClick={() => handleRemove(p.id)}
                >
                  Remove
                </button>
                <button
                  type="button"
                  data-testid={`reissue-${p.id}`}
                  onClick={() => void handleReissue(p.id)}
                >
                  Reissue link
                </button>
              </div>
            );
          })}
        </section>

        <footer class="players-dialog__footer">
          <button type="button" data-testid="toggle-joining" onClick={toggleJoining}>
            {joiningOpen ? "Close joining" : "Open joining"}
          </button>
        </footer>

        {reissueQr && (
          <div class="players-dialog__reissue" data-testid="reissue-qr">
            <p>Share this link with the player:</p>
            <img src={reissueQr} alt="Join QR" />
            <a href={tableUrl(`/play/${store.code}`)}>{tableUrl(`/play/${store.code}`)}</a>
          </div>
        )}
      </div>
    </div>
  );
}
