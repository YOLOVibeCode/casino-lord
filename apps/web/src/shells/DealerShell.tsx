import { createElement } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import type { ComponentType } from "preact";
import { buildBetsView, type ResultEnvelope } from "@casino-lord/core";
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
import { useConfirm } from "../ui/ConfirmSheet.js";
import { usePrompt } from "../ui/PromptSheet.js";
import { useToast } from "../ui/Toast.js";
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
  const virtualTriggerLabel =
    module.virtual?.kind === "wheel" ? "SPIN" : module.virtual?.kind === "dice" ? "ROLL" : "DEAL";
  const awaitingPlayerAction =
    virtualTable && virtualStatus?.awaiting === "action" && virtualStatus.turnPlayerId;
  const confirmState = module.confirm(composed.module, rules);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [editingEnvelope, setEditingEnvelope] = useState<ResultEnvelope<unknown> | null>(null);
  const toast = useToast();
  const { confirm } = useConfirm();
  const { prompt } = usePrompt();
  const [rotateHintDismissed, setRotateHintDismissed] = useState(
    () => sessionStorage.getItem(ROTATE_HINT_KEY) === "1",
  );

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
      betting.onDealerEntry();
      store.record(confirmState.result, { quick: false });
      if (confirmState.autoSeries) {
        store.startNewSeries(undefined, { auto: true });
      }
    }
    clearConfirmTimer();
  }, [
    betting,
    clearConfirmTimer,
    confirmState,
    deviceSettings.haptics,
    editingEnvelope,
    module.id,
    store,
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
      toast.error(check.reason ?? "Undo blocked.", { testId: "dealer-toast" });
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
  }, [composed.module, editingEnvelope, store, undoArmed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        handleUndo();
      }
      if (e.key === "Enter" && confirmState?.enabled) {
        e.preventDefault();
        startConfirmDelay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmState?.enabled, handleUndo, startConfirmDelay]);

  const dismissRotateHint = useCallback(() => {
    sessionStorage.setItem(ROTATE_HINT_KEY, "1");
    setRotateHintDismissed(true);
  }, []);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
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
          toast.error("No series to export", { testId: "dealer-toast" });
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

      await navigator.clipboard.writeText(text);
      setMenuOpen(false);
    } catch {
      toast.error("Export failed", { testId: "dealer-toast" });
    }
  };

  const importPreview = (text: string): string | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const envelope = parseExportForImport(trimmed);
    if ("error" in envelope) return null;
    return `${envelope.players.length} players, ${envelope.bets.length} bets — not imported`;
  };

  const handleImport = async () => {
    const text = await prompt({
      title: "Import series",
      label: "Paste series import text",
      multiline: true,
      confirmLabel: "Import",
      pasteFromClipboard: true,
      preview: importPreview,
    });
    if (!text) return;
    const envelope = parseExportForImport(text);
    const body = "error" in envelope ? text : envelope.body;
    const imported = module.importSeries(body, rules);
    if ("error" in imported) {
      toast.error(imported.error, { testId: "dealer-toast" });
      return;
    }
    store.importResults(imported.results);
    for (const warning of imported.warnings) {
      toast.info(warning, { testId: "dealer-toast" });
    }
    setMenuOpen(false);
  };

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

  const handleConfirmClick = useCallback(() => {
    if (readOnly) return;
    if (!confirmState?.enabled || !confirmState.result) {
      toast.info("Complete the hand before confirming.", { testId: "dealer-toast" });
      return;
    }
    startConfirmDelay();
  }, [confirmState, readOnly, startConfirmDelay, toast]);

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
            Editing Hand {editingEnvelope.index + 1} · Cancel
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
            record: store.record,
            autoAdvance: deviceSettings.autoAdvance,
            expressMode: deviceSettings.expressMode,
            haptics: deviceSettings.haptics,
            editMode,
          })}
        </div>
      )}

      <div class="dealer-shell__bottom" data-testid="dealer-bottom-bar">
        <div class="dealer-shell__toolbar">
          {playerModeOn && (
            <>
              <button
                type="button"
                class="dealer-shell__tool-btn"
                data-testid="players-btn"
                disabled={!syncStore}
                aria-label="Players"
                onClick={() => setActiveDialog("players")}
              >
                👥
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
                🏦
              </button>
            </>
          )}
          <div class="dealer-shell__menu">
            <button
              type="button"
              class="dealer-shell__tool-btn"
              aria-label="Menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              ⚙
            </button>
            {menuOpen && (
              <div class="dealer-shell__menu-panel">
                {onNewTable && (
                  <button
                    type="button"
                    data-testid="menu-new-table"
                    onClick={() => {
                      void (async () => {
                        const ok = await confirm({
                          title: "Start a new table?",
                          confirmLabel: "New table",
                        });
                        if (ok) {
                          onNewTable();
                          setMenuOpen(false);
                        }
                      })();
                    }}
                  >
                    New Table
                  </button>
                )}
                <button
                  type="button"
                  data-testid="menu-new-series"
                  onClick={() => {
                    void (async () => {
                      const ok = await confirm({
                        title: `Start new ${module.seriesLabel}?`,
                        confirmLabel: `New ${module.seriesLabel}`,
                      });
                      if (ok) {
                        store.startNewSeries();
                        setMenuOpen(false);
                      }
                    })();
                  }}
                >
                  New {module.seriesLabel}
                </button>
                <button
                  type="button"
                  data-testid="menu-end-session"
                  onClick={() => {
                    void (async () => {
                      const endBody = virtualTable
                        ? "Displays will show the final leaderboard. You will be offered an export with chips issued, final bankrolls, and results. The virtual seed will be revealed."
                        : "Displays will show the final leaderboard. You will be offered an export with chips issued, final bankrolls, and results.";
                      const ok = await confirm({
                        title: "End session?",
                        body: endBody,
                        destructive: true,
                        confirmLabel: "Hold to end session",
                      });
                      if (ok) {
                        store.endSession();
                        setMenuOpen(false);
                      }
                    })();
                  }}
                >
                  End Session
                </button>
                <button type="button" onClick={() => void handleExport()}>
                  Export
                </button>
                {virtualTable && (
                  <a href={tableUrl(`/verify?code=${store.code}`)} data-testid="menu-export-verify">
                    Verify export
                  </a>
                )}
                <button type="button" data-testid="menu-import" onClick={() => void handleImport()}>
                  Import
                </button>
                <a href={tableUrl(`/verify?code=${store.code}`)} data-testid="menu-verify">
                  Verify fairness
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
                disabled={readOnly}
                data-testid="force-btn"
                onClick={() => store.sendVirtual("force")}
              >
                Force
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
                {undoArmed ? `Tap again to undo Hand ${undoHand}` : "UNDO"}
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
