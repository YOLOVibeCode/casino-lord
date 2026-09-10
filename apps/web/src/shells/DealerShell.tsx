import { createElement } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import type { ComponentType } from "preact";
import { buildBetsView, type ResultEnvelope, type TableEvent } from "@casino-lord/core";
import type { UntypedGameModule } from "../table/module-types.js";
import type { DeviceSettings } from "../settings/device-settings.js";
import { tapHaptic } from "../settings/haptics.js";
import { useBettingRound } from "../betting/use-betting-round.js";
import { fetchTableExport } from "../sync/api.js";
import { getSyncBaseUrl } from "../sync/config.js";
import { QrDialog } from "../sync/QrDialog.js";
import { tableUrl } from "../sync/urls.js";
import { isSyncStore } from "../table/sync-store-types.js";
import type { TableStore } from "../table/store.js";
import { useStore } from "../hooks/use-store.js";
import { buildExportText, buildSeriesFromStoreEvents } from "../table/export.js";
import { parseExportForImport } from "../verify/replay-fairness.js";
import { currentSeriesCommit } from "../table/meta.js";
import { BankPanel } from "./BankPanel.js";
import { BettingBar } from "./BettingBar.js";
import { SettingsDialog } from "./SettingsDialog.js";
import { HistoryDialog } from "./HistoryDialog.js";
import { CalculatorDialog } from "./CalculatorDialog.js";
import { PlayersDialog } from "./PlayersDialog.js";
import "./dealer-shell.css";

export interface DealerShellProps {
  store: TableStore;
  module: UntypedGameModule;
  rules: unknown;
  deviceSettings: DeviceSettings;
  onDeviceSettingsChange: (settings: DeviceSettings) => void;
  onNewTable?: () => void;
  onDisconnect?: () => void;
}

type ActiveDialog = "settings" | "history" | "calculator" | "qr" | "players" | "bank" | null;

const ROTATE_HINT_KEY = "casino-lord:dealer-rotate-hint-dismissed";

export const SOLO_PLAYERS_HINT =
  "Players requires a synced table — use Create Table on the home screen.";

const REJECT_MESSAGES: Record<string, string> = {
  SESSION_ENDED: "This table session has ended.",
  NOT_FOUND: "That table code was not found.",
  BAD_TOKEN: "The dealer token is invalid.",
  DECLINED: "The action was declined by the server.",
};

export function describeReject(reason: string): string {
  return REJECT_MESSAGES[reason] ?? `Action rejected: ${reason}`;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function lastRecordedEvent(
  events: TableEvent[],
): Extract<TableEvent, { type: "RESULT_RECORDED" }> | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event?.type === "RESULT_RECORDED") return event;
  }
  return undefined;
}

function resultDetail(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const r = data as Record<string, unknown>;
  if (typeof r.total === "number") {
    return r.hard === true ? `${r.total}H` : String(r.total);
  }
  const pt = r.playerTotal;
  const bt = r.bankerTotal;
  if (typeof pt === "number" && typeof bt === "number") return `${pt}–${bt}`;
  if (typeof r.value === "number") return String(r.value);
  if (typeof r.outcome === "string") return r.outcome;
  return undefined;
}

export function formatRecordedToast(resultLabel: string, index: number, detail?: string): string {
  const base = `${resultLabel} ${index + 1} recorded`;
  return detail ? `${base} · ${detail}` : base;
}

export interface InlineConfirmProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function InlineConfirm({ message, onConfirm, onCancel }: InlineConfirmProps) {
  return (
    <div class="dealer-shell__overlay" data-testid="inline-confirm" role="dialog" aria-modal="true">
      <div class="dealer-shell__overlay-card">
        <p>{message}</p>
        <div class="dealer-shell__overlay-actions">
          <button type="button" data-testid="inline-confirm-yes" onClick={onConfirm}>
            Confirm
          </button>
          <button type="button" data-testid="inline-confirm-no" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export interface InlinePromptProps {
  message: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InlinePrompt({
  message,
  defaultValue = "",
  onSubmit,
  onCancel,
}: InlinePromptProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div class="dealer-shell__overlay" data-testid="inline-prompt" role="dialog" aria-modal="true">
      <div class="dealer-shell__overlay-card">
        <p>{message}</p>
        <textarea
          class="dealer-shell__prompt-input"
          data-testid="inline-prompt-input"
          value={value}
          onInput={(e) => setValue((e.target as HTMLTextAreaElement).value)}
        />
        <div class="dealer-shell__overlay-actions">
          <button type="button" data-testid="inline-prompt-submit" onClick={() => onSubmit(value)}>
            OK
          </button>
          <button type="button" data-testid="inline-prompt-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

type PendingConfirm = { message: string; onConfirm: () => void } | null;
type PendingPrompt = {
  message: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
} | null;

export function DealerShell({
  store,
  module,
  rules,
  deviceSettings,
  onDeviceSettingsChange,
  onNewTable,
  onDisconnect,
}: DealerShellProps) {
  const { route } = useLocation();
  useStore(store);
  const composed = store.getComposed();
  const table = store.getTableMeta();
  const playerModeOn = composed.platform.participation.playerMode === "on";
  const virtualTable = composed.platform.participation.outcomeSource === "virtual";
  const bankHouse = playerModeOn && composed.platform.participation.bank === "house";
  const seriesCommit = virtualTable ? currentSeriesCommit(store.events) : null;
  const virtualStatus = store.getVirtualStatus?.() ?? null;
  const virtualPending = store.getVirtualPending?.() ?? null;
  const virtualTriggerLabel =
    module.virtual?.kind === "wheel" ? "SPIN" : module.virtual?.kind === "dice" ? "ROLL" : "DEAL";
  const awaitingPlayerAction =
    virtualTable && virtualStatus?.awaiting === "action" && virtualStatus.turnPlayerId;
  const confirmState = module.confirm(composed.module, rules);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [editingEnvelope, setEditingEnvelope] = useState<ResultEnvelope<unknown> | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<"error" | "info">("error");
  const [rotateHintDismissed, setRotateHintDismissed] = useState(
    () => sessionStorage.getItem(ROTATE_HINT_KEY) === "1",
  );
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt>(null);
  const [forceUsed, setForceUsed] = useState(false);

  const settings = composed.platform.settings;
  const undoCheck = store.canUndoLastResult();
  const betting = useBettingRound({
    store,
    composed,
    settings,
    editing: editingEnvelope !== null,
    newRoundId: () => crypto.randomUUID(),
  });
  const betsView = buildBetsView(composed.platform, module, composed.module);
  const [undoArmed, setUndoArmed] = useState(false);
  const [undoHand, setUndoHand] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [confirmProgress, setConfirmProgress] = useState(0);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRejectReason = useRef<string | null>(null);

  const showToast = useCallback((message: string, kind: "error" | "info" = "error") => {
    setToastMsg(message);
    setToastKind(kind);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 4000);
  }, []);

  const dismissToast = useCallback(() => {
    setToastMsg(null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);
  const confirmTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const confirmStarted = useRef(0);

  const clearConfirmTimer = useCallback(() => {
    if (confirmTimer.current) clearInterval(confirmTimer.current);
    confirmTimer.current = null;
    setConfirming(false);
    setConfirmProgress(0);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingEnvelope(null);
    store.emit({ type: "LIVE_INPUT", payload: { slots: {} }, source: "dealer" });
  }, [store]);

  const toastForRecorded = useCallback(
    (result: unknown, index: number) => {
      const detail =
        confirmState?.label?.replace(/^✓\s*/, "").replace(/^CONFIRM\s+/i, "") ??
        resultDetail(result);
      showToast(formatRecordedToast(module.resultLabel, index, detail), "info");
    },
    [confirmState?.label, module.resultLabel, showToast],
  );

  const handleRecord = useCallback(
    (result: unknown, opts: { quick: boolean }) => {
      betting.onDealerEntry();
      const index = Array.isArray((composed.module as { results?: unknown[] }).results)
        ? (composed.module as { results: unknown[] }).results.length
        : 0;
      store.record(result, opts);
      if (!opts.quick) {
        toastForRecorded(result, index);
      }
    },
    [betting, composed.module, store, toastForRecorded],
  );

  const executeConfirm = useCallback(() => {
    if (!confirmState?.enabled || !confirmState.result) return;
    tapHaptic(deviceSettings.haptics);
    const clearLiveInput =
      module.id === "craps"
        ? { type: "LIVE_INPUT" as const, payload: { a: null, b: null }, source: "dealer" as const }
        : { type: "LIVE_INPUT" as const, payload: { slots: {} }, source: "dealer" as const };
    if (editingEnvelope) {
      store.editResult({
        ...editingEnvelope,
        data: confirmState.result,
        quick: editingEnvelope.quick,
      });
      setEditingEnvelope(null);
      store.emit(clearLiveInput);
    } else {
      const index = Array.isArray((composed.module as { results?: unknown[] }).results)
        ? (composed.module as { results: unknown[] }).results.length
        : 0;
      betting.onDealerEntry();
      store.record(confirmState.result, { quick: false });
      toastForRecorded(confirmState.result, index);
      if (confirmState.autoSeries) {
        store.startNewSeries(undefined, { auto: true });
      }
    }
    clearConfirmTimer();
  }, [
    betting,
    clearConfirmTimer,
    composed.module,
    confirmState,
    deviceSettings.haptics,
    editingEnvelope,
    module.id,
    store,
    toastForRecorded,
  ]);

  const startConfirmDelay = useCallback(() => {
    if (!confirmState?.enabled || !confirmState.result) return;
    const delay = deviceSettings.confirmDelayMs;
    if (delay <= 0) {
      executeConfirm();
      return;
    }
    setConfirming(true);
    confirmStarted.current = Date.now();
    confirmTimer.current = setInterval(() => {
      const elapsed = Date.now() - confirmStarted.current;
      const p = Math.min(1, elapsed / delay);
      setConfirmProgress(p);
      if (p >= 1) {
        executeConfirm();
      }
    }, 50);
  }, [confirmState, deviceSettings.confirmDelayMs, executeConfirm]);

  const handleUndo = useCallback(() => {
    if (editingEnvelope) return;
    const results = (composed.module as { results?: unknown[] }).results;
    const count = Array.isArray(results) ? results.length : 0;
    if (count === 0) return;

    const check = store.canUndoLastResult();
    if (!check.ok) {
      showToast(check.reason ?? "Undo blocked.");
      return;
    }

    if (!undoArmed) {
      setUndoArmed(true);
      setUndoHand(count);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndoArmed(false), 3000);
      return;
    }

    store.undoLastResult();
    setUndoArmed(false);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, [composed.module, editingEnvelope, showToast, store, undoArmed]);

  const requestNewSeries = useCallback(() => {
    setPendingConfirm({
      message: `Start new ${module.seriesLabel}?`,
      onConfirm: () => {
        store.startNewSeries();
        setMenuOpen(false);
        setPendingConfirm(null);
      },
    });
  }, [module.seriesLabel, store]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        handleUndo();
      }
      if (e.key === "Enter" && confirmState?.enabled) {
        e.preventDefault();
        startConfirmDelay();
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        requestNewSeries();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmState?.enabled, handleUndo, requestNewSeries, startConfirmDelay]);

  useEffect(() => {
    if (!virtualPending) {
      setForceUsed(false);
    }
  }, [virtualPending?.untilAt]);

  const dismissRotateHint = useCallback(() => {
    sessionStorage.setItem(ROTATE_HINT_KEY, "1");
    setRotateHintDismissed(true);
  }, []);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      clearConfirmTimer();
    },
    [clearConfirmTimer],
  );

  const confirmStyle = confirmState?.color
    ? { borderColor: confirmState.color, color: confirmState.color }
    : undefined;

  const handleExport = async () => {
    try {
      let text: string;
      const syncStore = isSyncStore(store) ? store : null;
      const dealerToken = syncStore?.getDealerToken() ?? null;

      if (syncStore && dealerToken) {
        text = await fetchTableExport(
          getSyncBaseUrl(),
          store.code,
          table.seriesNumber,
          dealerToken,
        );
      } else {
        const series = buildSeriesFromStoreEvents(store.events, table.seriesNumber);
        if (!series) {
          showToast("No series to export", "error");
          return;
        }
        const outcomeSource = composed.platform.participation.outcomeSource;
        text = buildExportText({
          game: store.game,
          code: store.code,
          seriesNumber: table.seriesNumber,
          seriesStartedAt: series.startedAt,
          source: outcomeSource,
          rules,
          module,
          series,
          events: store.events,
        });
      }

      try {
        await navigator.clipboard.writeText(text);
        showToast("Export copied to clipboard", "info");
        setMenuOpen(false);
      } catch {
        setPendingPrompt({
          message: "Clipboard unavailable — copy export text:",
          defaultValue: text,
          onSubmit: () => {
            setMenuOpen(false);
            setPendingPrompt(null);
          },
        });
      }
    } catch {
      showToast("Export failed", "error");
    }
  };

  const handleImportSubmit = useCallback(
    (text: string) => {
      if (!text.trim()) {
        setPendingPrompt(null);
        return;
      }
      const envelope = parseExportForImport(text);
      const body = "error" in envelope ? text : envelope.body;
      const imported = module.importSeries(body, rules);
      if ("error" in imported) {
        showToast(imported.error, "error");
        setPendingPrompt(null);
        return;
      }
      store.importResults(imported.results);
      if (imported.warnings.length > 0) {
        showToast(imported.warnings.join("\n"), "info");
      }
      setMenuOpen(false);
      setPendingPrompt(null);
    },
    [module, rules, showToast, store],
  );

  const handleQuickEdit = useCallback(
    (result: unknown) => {
      if (!editingEnvelope) return;
      store.editResult({
        ...editingEnvelope,
        data: result,
        quick: true,
      });
      setEditingEnvelope(null);
    },
    [editingEnvelope, store],
  );

  const handleVoidBets = useCallback(() => {
    const count = betsView.openBets.length;
    if (count === 0) return;
    setPendingConfirm({
      message: `Void all ${count} open bet${count === 1 ? "" : "s"}?`,
      onConfirm: () => {
        for (const bet of betsView.openBets) {
          store.emit({ type: "BET_REMOVED", betId: bet.id });
        }
        setPendingConfirm(null);
      },
    });
  }, [betsView.openBets, store]);

  const editMode =
    editingEnvelope !== null
      ? {
          envelope: editingEnvelope,
          onConfirm: () => {},
          onQuickEdit: handleQuickEdit,
        }
      : undefined;

  const syncStore = isSyncStore(store) ? store : null;
  const connectionState = syncStore?.getConnectionState() ?? null;
  const readOnly = syncStore?.isReadOnly() ?? false;

  useEffect(() => {
    if (!syncStore) return;
    return syncStore.subscribe(() => {
      const reason = syncStore.getRejectReason();
      if (reason && reason !== lastRejectReason.current) {
        lastRejectReason.current = reason;
        showToast(describeReject(reason), "error");
      }
    });
  }, [showToast, syncStore]);

  const handleConfirmClick = useCallback(() => {
    if (readOnly) return;
    if (!confirmState?.enabled || !confirmState.result) {
      showToast(`Complete the ${module.resultLabel.toLowerCase()} before confirming.`, "info");
      return;
    }
    startConfirmDelay();
  }, [confirmState, readOnly, showToast, startConfirmDelay]);

  const dotClass =
    connectionState === "offline"
      ? "dealer-shell__dot dealer-shell__dot--offline"
      : connectionState === "reconnecting"
        ? "dealer-shell__dot dealer-shell__dot--reconnecting"
        : "dealer-shell__dot";
  const dotTitle =
    connectionState === "connected"
      ? "Connected"
      : connectionState === "reconnecting"
        ? "Reconnecting"
        : connectionState === "offline"
          ? "Offline"
          : "Local / Solo";

  const undoLabel = undoArmed
    ? `Tap again to undo ${module.resultLabel} ${undoHand}`
    : `Undo last ${module.resultLabel}`;

  const forceLabel = virtualPending ? "Deal now" : "Force";

  return (
    <div class="dealer-shell" data-testid="dealer-shell">
      {!rotateHintDismissed && (
        <div class="dealer-shell__rotate-hint" data-testid="rotate-hint" role="status">
          <span>Rotate to portrait for the best dealer experience.</span>
          <button type="button" aria-label="Dismiss" onClick={dismissRotateHint}>
            ✕
          </button>
        </div>
      )}

      <header class="dealer-shell__header">
        {editingEnvelope ? (
          <button
            type="button"
            class="dealer-shell__edit-banner"
            data-testid="edit-banner"
            onClick={cancelEdit}
          >
            Editing {module.resultLabel} {editingEnvelope.index + 1} · Cancel
          </button>
        ) : (
          <>
            <span class={dotClass} title={dotTitle} data-testid="connection-dot" />
            <span>{store.code}</span>
            <span>·</span>
            <span>
              {module.seriesLabel} {table.seriesNumber}
            </span>
            <span>·</span>
            <span>
              {module.resultLabel} {table.resultIndex}
            </span>
            {playerModeOn && <span class="dealer-shell__player-count">👥 {table.playerCount}</span>}
            {virtualTable && seriesCommit && (
              <span class="dealer-shell__virtual-badge" data-testid="virtual-commit">
                VIRTUAL · FAIR · {seriesCommit.slice(0, 8)}
              </span>
            )}
          </>
        )}
      </header>

      {playerModeOn && (
        <BettingBar
          round={betting.round}
          betsView={betsView}
          countdownSec={betting.countdownSec}
          onToggle={() => {
            if (betting.round?.status === "open") betting.closeBets();
            else betting.openBets();
          }}
          onVoidBets={handleVoidBets}
        />
      )}

      {!virtualTable && (
        <div class="dealer-shell__module">
          {createElement(module.DealerView as unknown as ComponentType<Record<string, unknown>>, {
            state: composed.module,
            rules,
            table,
            events: store.events,
            players: composed.platform.players,
            emit: (body: Parameters<typeof store.emit>[0]) => {
              if (body.type === "LIVE_INPUT") betting.onDealerEntry();
              store.emit(body);
            },
            record: handleRecord,
            autoAdvance: deviceSettings.autoAdvance,
            expressMode: deviceSettings.expressMode,
            haptics: deviceSettings.haptics,
            editMode,
          })}
        </div>
      )}

      <div class="dealer-shell__bottom" data-testid="dealer-bottom-bar">
        {toastMsg && (
          <div
            class={`dealer-shell__toast${toastKind === "info" ? " dealer-shell__toast--info" : ""}`}
            data-testid="dealer-toast"
            role="alert"
          >
            <span>{toastMsg}</span>
            <button
              type="button"
              class="dealer-shell__toast-dismiss"
              aria-label="Dismiss"
              onClick={dismissToast}
            >
              ✕
            </button>
          </div>
        )}

        <div class="dealer-shell__toolbar">
          {playerModeOn && (
            <>
              <button
                type="button"
                class="dealer-shell__tool-btn"
                data-testid="players-btn"
                disabled={!syncStore}
                aria-label="Players"
                title={!syncStore ? SOLO_PLAYERS_HINT : "Players"}
                onClick={() => setActiveDialog("players")}
              >
                <span class="dealer-shell__tool-icon" aria-hidden="true">
                  👥
                </span>
                <span class="dealer-shell__tool-label">Players</span>
              </button>
              <button
                type="button"
                class="dealer-shell__tool-btn"
                disabled={!bankHouse}
                title={bankHouse ? "Bank" : "House bank not enabled"}
                data-testid="bank-btn"
                aria-label="Bank"
                onClick={() => setActiveDialog("bank")}
              >
                <span class="dealer-shell__tool-icon" aria-hidden="true">
                  🏦
                </span>
                <span class="dealer-shell__tool-label">Bank</span>
              </button>
            </>
          )}
          <div class="dealer-shell__menu">
            <button
              type="button"
              class="dealer-shell__tool-btn"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              data-testid="menu-btn"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span class="dealer-shell__tool-icon" aria-hidden="true">
                ⚙
              </span>
              <span class="dealer-shell__tool-label">Menu</span>
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  class="dealer-shell__menu-backdrop"
                  aria-label="Close menu"
                  data-testid="menu-backdrop"
                  onClick={() => setMenuOpen(false)}
                />
                <div class="dealer-shell__menu-panel">
                  {onNewTable && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingConfirm({
                          message: "Start a new table?",
                          onConfirm: () => {
                            onNewTable();
                            setMenuOpen(false);
                            setPendingConfirm(null);
                          },
                        });
                      }}
                    >
                      New Table
                    </button>
                  )}
                  <button type="button" data-testid="menu-new-series" onClick={requestNewSeries}>
                    New {module.seriesLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingConfirm({
                        message: "End session?",
                        onConfirm: () => {
                          store.endSession();
                          setMenuOpen(false);
                          setPendingConfirm(null);
                        },
                      });
                    }}
                  >
                    End Session
                  </button>
                  <button
                    type="button"
                    data-testid="menu-export"
                    onClick={() => void handleExport()}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    data-testid="menu-import"
                    onClick={() => {
                      setPendingPrompt({
                        message: "Paste series import text:",
                        onSubmit: handleImportSubmit,
                      });
                    }}
                  >
                    Import
                  </button>
                  <a href={tableUrl(`/verify?code=${store.code}`)} data-testid="menu-verify">
                    {virtualTable ? "Verify export" : "Verify fairness"}
                  </a>
                  <button
                    type="button"
                    data-testid="menu-settings"
                    onClick={() => {
                      setActiveDialog("settings");
                      setMenuOpen(false);
                    }}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    data-testid="menu-history"
                    onClick={() => {
                      setActiveDialog("history");
                      setMenuOpen(false);
                    }}
                  >
                    History
                  </button>
                  <button
                    type="button"
                    data-testid="menu-calculator"
                    onClick={() => {
                      setActiveDialog("calculator");
                      setMenuOpen(false);
                    }}
                  >
                    Calculator
                  </button>
                  <button
                    type="button"
                    disabled={!syncStore}
                    data-testid="menu-show-qr"
                    onClick={() => {
                      setActiveDialog("qr");
                      setMenuOpen(false);
                    }}
                  >
                    Show QR
                  </button>
                  <button
                    type="button"
                    data-testid="menu-disconnect"
                    onClick={() => {
                      setMenuOpen(false);
                      if (onDisconnect) {
                        onDisconnect();
                      } else {
                        route("/");
                      }
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div class="dealer-shell__actions">
          {virtualTable ? (
            <>
              {awaitingPlayerAction && (
                <span class="dealer-shell__virtual-hint" data-testid="virtual-action-hint">
                  Waiting for {virtualStatus?.turnPrompt ?? "player action"}
                </span>
              )}
              {virtualPending && (
                <span class="dealer-shell__virtual-hint" data-testid="virtual-pending-hint">
                  Dealing…
                </span>
              )}
              <button
                type="button"
                class="dealer-shell__btn dealer-shell__btn--confirm"
                disabled={readOnly || !!awaitingPlayerAction}
                data-testid="deal-btn"
                title={awaitingPlayerAction ? "Awaiting player action" : undefined}
                onClick={() => {
                  tapHaptic(deviceSettings.haptics);
                  store.sendVirtual("trigger");
                }}
              >
                {virtualTriggerLabel}
              </button>
              <button
                type="button"
                class="dealer-shell__btn"
                disabled={readOnly || forceUsed}
                data-testid="force-btn"
                onClick={() => {
                  if (forceUsed) return;
                  setForceUsed(true);
                  store.sendVirtual("force");
                }}
              >
                {forceLabel}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                class="dealer-shell__btn"
                onClick={handleUndo}
                disabled={!!editingEnvelope || readOnly || !undoCheck.ok}
                data-testid="undo-btn"
                title={undoCheck.reason}
              >
                {undoLabel}
              </button>
              <button
                type="button"
                class={`dealer-shell__btn dealer-shell__btn--confirm${!confirmState?.enabled || readOnly ? " dealer-shell__btn--disabled" : ""}`}
                style={confirmStyle}
                aria-disabled={!confirmState?.enabled || readOnly}
                onClick={handleConfirmClick}
                data-testid="confirm-btn"
              >
                {confirming && (
                  <span
                    class="dealer-shell__confirm-progress"
                    style={{ transform: `scaleX(${confirmProgress})` }}
                  />
                )}
                <span>
                  {editingEnvelope ? "✓ SAVE EDIT" : (confirmState?.label ?? "CONFIRM")}
                  {confirmState?.badges && (
                    <span class="dealer-shell__badges"> · {confirmState.badges.join(" · ")}</span>
                  )}
                </span>
              </button>
              {confirming && (
                <button type="button" class="dealer-shell__btn" onClick={clearConfirmTimer}>
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {pendingConfirm && (
        <InlineConfirm
          message={pendingConfirm.message}
          onConfirm={pendingConfirm.onConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      {pendingPrompt && (
        <InlinePrompt
          message={pendingPrompt.message}
          {...(pendingPrompt.defaultValue !== undefined
            ? { defaultValue: pendingPrompt.defaultValue }
            : {})}
          onSubmit={pendingPrompt.onSubmit}
          onCancel={() => setPendingPrompt(null)}
        />
      )}

      {activeDialog === "bank" && bankHouse && (
        <BankPanel
          store={store}
          composed={composed}
          settings={settings}
          onClose={() => setActiveDialog(null)}
        />
      )}
      {activeDialog === "settings" && (
        <SettingsDialog
          store={store}
          module={module}
          rules={rules}
          deviceSettings={deviceSettings}
          onDeviceChange={onDeviceSettingsChange}
          onClose={() => setActiveDialog(null)}
        />
      )}
      {activeDialog === "history" && (
        <HistoryDialog
          store={store}
          module={module}
          rules={rules}
          onClose={() => setActiveDialog(null)}
          onEdit={(envelope) => {
            setEditingEnvelope(envelope);
            setActiveDialog(null);
          }}
        />
      )}
      {activeDialog === "calculator" && (
        <CalculatorDialog
          store={store}
          module={module}
          rules={rules}
          onClose={() => setActiveDialog(null)}
        />
      )}
      {activeDialog === "players" && syncStore && (
        <PlayersDialog
          store={syncStore}
          {...(module.seats !== undefined ? { seatsConfig: module.seats } : {})}
          onClose={() => setActiveDialog(null)}
        />
      )}
      {activeDialog === "qr" && syncStore && (
        <QrDialog
          entries={[
            {
              label: "Display",
              url: tableUrl(`/display/${store.code}`),
            },
            {
              label: "Dealer",
              url: tableUrl(
                `/dealer/${store.code}?t=${encodeURIComponent(syncStore.getDealerToken() ?? "")}`,
              ),
              warning: "Anyone with this link can control the table.",
            },
          ]}
          onClose={() => setActiveDialog(null)}
        />
      )}
    </div>
  );
}
