import { useCallback, useRef, useState } from "preact/hooks";
import { useDialogA11y } from "./use-dialog-a11y.js";
import { getBankroll } from "@casino-lord/core";
import type { BlackjackRules } from "@casino-lord/game-blackjack";
import type { CrapsState } from "@casino-lord/game-craps";
import { reissuePlayerToken } from "../sync/api.js";
import { getSyncBaseUrl } from "../sync/config.js";
import { qrDataUrl } from "../sync/qr.js";
import { tableUrl } from "../sync/urls.js";
import { getGame } from "../table/games.js";
import type { SyncStore } from "../table/sync-store-types.js";
import "./players-dialog.css";

export interface PlayersDialogProps {
  store: SyncStore;
  onClose: () => void;
  seatsConfig?: { max: number; assign: "dealer" | "player" | "auto" };
}

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastState {
  message: string;
  action?: ToastAction;
}

function crapsState(module: unknown): CrapsState | null {
  if (typeof module !== "object" || module === null) return null;
  if (!("currentShooterId" in module) || !("liveInput" in module)) return null;
  return module as CrapsState;
}

export function PlayersDialog({ store, onClose, seatsConfig }: PlayersDialogProps) {
  const composed = store.getComposed();
  const pending = store.getPendingPlayers();
  const players = composed.platform.players.filter((p) => p.status !== "removed");
  const joiningOpen = composed.platform.settings.players.joiningOpen;
  const defaultBuyIn = composed.platform.settings.bank.defaultBuyIn;
  const autoBuyIn = composed.platform.settings.bank.autoBuyIn;
  const isCraps = store.game === "craps";
  const craps = isCraps ? crapsState(composed.module) : null;
  const shooterRotation = composed.platform.settings.virtual.shooterRotation;
  const diceLive = craps !== null && (craps.liveInput.a !== null || craps.liveInput.b !== null);
  const dealerAssigns = shooterRotation === "dealer_assigns";
  const assignLabel = dealerAssigns ? "Make shooter" : "Override rotation";
  const seatConfig = seatsConfig ?? getGame(store.game)?.module?.seats;
  const rules = store.getRules() as BlackjackRules;
  const showSeatSelect =
    store.game === "blackjack" && seatConfig !== undefined && seatConfig.assign !== "player";
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [reissueState, setReissueState] = useState<{ qr: string; url: string } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { dialogProps } = useDialogA11y({
    panelRef,
    onClose,
    titleId: "players-dialog-title",
  });
  const dealerToken = store.getDealerToken();

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = useCallback((message: string, action?: ToastAction) => {
    setToast({ message, ...(action !== undefined ? { action } : {}) });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const issueBuyIn = (playerId: string, amount: number): void => {
    void store.emit({ type: "BANK_ISSUED", playerId, amount, reason: "buyin" });
  };

  const handleApprove = (player: { id: string; name: string }): void => {
    store.sendAdmit(player.id, true);
    if (!autoBuyIn) {
      showToast(`${player.name} joined — issue ${defaultBuyIn} chips?`, {
        label: `Issue ${defaultBuyIn}`,
        onClick: () => {
          issueBuyIn(player.id, defaultBuyIn);
          dismissToast();
        },
      });
    }
  };

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

  const handleAssignShooter = (playerId: string): void => {
    void store.emit({ type: "TURN_ASSIGNED", playerId, role: "shooter" });
  };

  const handleSeatChange = (playerId: string, raw: string): void => {
    const seat = raw === "" ? undefined : Number(raw);
    if (seat !== undefined && (Number.isNaN(seat) || seat < 1 || seat > rules.seats)) {
      return;
    }
    if (seat !== undefined) {
      const occupant = players.find((p) => p.id !== playerId && p.seat === seat);
      if (occupant) {
        void store.emit({
          type: "PLAYER_UPDATED",
          playerId: occupant.id,
          patch: { seat: undefined },
        });
      }
    }
    void store.emit({
      type: "PLAYER_UPDATED",
      playerId,
      patch: seat === undefined ? { seat: undefined } : { seat },
    });
  };

  const handleReissue = async (playerId: string): Promise<void> => {
    if (!dealerToken) return;
    try {
      const { playerToken } = await reissuePlayerToken(
        getSyncBaseUrl(),
        store.code,
        playerId,
        dealerToken,
      );
      const playUrl = tableUrl(`/play/${store.code}?t=${encodeURIComponent(playerToken)}`);
      const qr = await qrDataUrl(playUrl);
      setReissueState({ qr, url: playUrl });
    } catch {
      setReissueState(null);
    }
  };

  return (
    <div class="players-dialog__backdrop" data-testid="players-dialog">
      <div
        ref={panelRef}
        class="players-dialog"
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="players-dialog__header">
          <h2 id="players-dialog-title">Players</h2>
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
                  onClick={() => handleApprove(p)}
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
          {isCraps && craps !== null && (
            <p
              class={`players-dialog__rotation-hint${dealerAssigns ? " players-dialog__rotation-hint--prominent" : ""}`}
              data-testid="shooter-rotation-hint"
            >
              {dealerAssigns
                ? "Assign the shooter before each hand."
                : "Shooter rotates in join order after seven-out. Override below if needed."}
            </p>
          )}
          {players.length === 0 && pending.length === 0 && (
            <p class="players-dialog__empty">No players yet</p>
          )}
          {players.map((p) => {
            const bankroll = getBankroll(composed.platform, p.id);
            const connected = store
              .getPresence()
              .players.some((entry) => entry.id === p.id && entry.connected);
            const isShooter = craps !== null && p.id === craps.currentShooterId;
            const canAssign = isCraps && craps !== null && p.status === "active" && !isShooter;
            const needsBuyIn = p.status === "active" && bankroll === 0;
            return (
              <div key={p.id} class="players-dialog__row" data-testid={`player-row-${p.id}`}>
                <span class="players-dialog__dot" style={{ background: p.color }} />
                <span>
                  {p.name}{" "}
                  {isShooter && (
                    <span
                      class="players-dialog__shooter-badge"
                      data-testid={`shooter-badge-${p.id}`}
                    >
                      Shooter
                    </span>
                  )}
                  <span class="players-dialog__status">
                    {p.status === "away" ? "away" : connected ? "active" : "offline"}
                  </span>
                </span>
                <span class="players-dialog__bank">{bankroll}</span>
                {needsBuyIn && (
                  <button
                    type="button"
                    data-testid={`issue-buyin-${p.id}`}
                    onClick={() => issueBuyIn(p.id, defaultBuyIn)}
                  >
                    Issue {defaultBuyIn}
                  </button>
                )}
                {showSeatSelect && (
                  <select
                    class="players-dialog__seat-select"
                    data-testid={`seat-select-${p.id}`}
                    value={p.seat !== undefined ? String(p.seat) : ""}
                    onChange={(e) => handleSeatChange(p.id, (e.target as HTMLSelectElement).value)}
                  >
                    <option value="">—</option>
                    {Array.from({ length: rules.seats }, (_, i) => {
                      const seat = i + 1;
                      return (
                        <option key={seat} value={String(seat)}>
                          Seat {seat}
                        </option>
                      );
                    })}
                  </select>
                )}
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
                {canAssign && (
                  <button
                    type="button"
                    class={`players-dialog__make-shooter${dealerAssigns ? " players-dialog__make-shooter--primary" : ""}`}
                    data-testid={`make-shooter-${p.id}`}
                    disabled={diceLive}
                    onClick={() => handleAssignShooter(p.id)}
                  >
                    {assignLabel}
                  </button>
                )}
              </div>
            );
          })}
        </section>

        <footer class="players-dialog__footer">
          <button type="button" data-testid="toggle-joining" onClick={toggleJoining}>
            {joiningOpen ? "Close joining" : "Open joining"}
          </button>
        </footer>

        {reissueState && (
          <div class="players-dialog__reissue" data-testid="reissue-qr">
            <p>Share this link with the player:</p>
            <p class="players-dialog__reissue-warning" data-testid="reissue-warning">
              Anyone with this link can join as this player.
            </p>
            <img src={reissueState.qr} alt="Join QR" />
            <a href={reissueState.url} data-testid="reissue-link">
              {reissueState.url}
            </a>
          </div>
        )}

        {toast && (
          <div class="players-dialog__toast" data-testid="players-toast" role="alert">
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                data-testid="players-toast-action"
                onClick={toast.action.onClick}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
