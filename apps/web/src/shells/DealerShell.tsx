import { createElement } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import type { ComponentType } from "preact";
import {
  buildBetsView,
  buildLeaderboard,
  buyInByPlayerFromEvents,
  getCurrentSeriesResults,
  type ResultEnvelope,
} from "@casino-lord/core";
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
import { SessionEndedPanel } from "./SessionEndedPanel.js";
import { VirtualPanel } from "./VirtualPanel.js";
import { useConfirm } from "../ui/ConfirmSheet.js";
import { usePrompt } from "../ui/PromptSheet.js";
import { useToast } from "../ui/Toast.js";
import "../ui/sheet.css";
import "./dealer-shell.css";

const OPTIMISTIC_DEALING_MS = 8000;

const REJECT_REASON_LABELS: Record<string, string> = {
  SESSION_ENDED: "session ended",
  DEALING: "dealing in progress",
  demoted: "you were replaced as dealer",
  "not authorized": "not authorized",
  OFFLINE: "offline",
  rejected: "rejected",
  DECLINED: "declined",
};

function formatRejectReason(reason: string): string {
  return REJECT_REASON_LABELS[reason] ?? reason.replace(/_/g, " ").toLowerCase();
}

function shouldIgnoreKeyboardShortcut(menuOpen: boolean): boolean {
  if (menuOpen) return true;
  if (document.querySelector('[data-testid="confirm-sheet"]')) return true;
  if (document.querySelector('[data-testid="prompt-sheet"]')) return true;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function countSeriesResults(events: readonly { type: string }[]): number {
  return events.filter((e) => e.type === "RESULT_RECORDED").length;
}

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
  const sessionEnded = store.events.some((e) => e.type === "SESSION_ENDED");
  const buyInByPlayer = buyInByPlayerFromEvents(store.events);
  const chipsIssuedTotal = Object.values(buyInByPlayer).reduce((sum, n) => sum + n, 0);
  const activePlayerCount = composed.platform.players.filter((p) => p.status !== "removed").length;
  const topBankrolls = buildLeaderboard(composed.platform, buyInByPlayer)
    .sort((a, b) => b.bankroll - a.bankroll)
    .slice(0, 3);
  const latestSeriesEnded = [...store.events].reverse().find((e) => e.type === "SERIES_ENDED");
  const revealedSeed =
    latestSeriesEnded?.type === "SERIES_ENDED" && "seed" in latestSeriesEnded
      ? latestSeriesEnded.seed
      : undefined;
  const resultCount = countSeriesResults(store.events);
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
  const lastToastedRejectRef = useRef<string | null>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const prevSessionEndedRef = useRef(sessionEnded);
  const [forceTapped, setForceTapped] = useState(false);
  const [optimisticDealing, setOptimisticDealing] = useState(false);
  const optimisticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultCountRef = useRef(countSeriesResults(store.events));

  const clearOptimisticDealing = useCallback(() => {
    if (optimisticTimerRef.current) {
      clearTimeout(optimisticTimerRef.current);
      optimisticTimerRef.current = null;
    }
    setOptimisticDealing(false);
  }, []);

  const startOptimisticDealing = useCallback(() => {
    clearOptimisticDealing();
    setOptimisticDealing(true);
    optimisticTimerRef.current = setTimeout(() => {
      optimisticTimerRef.current = null;
      setOptimisticDealing(false);
    }, OPTIMISTIC_DEALING_MS);
  }, [clearOptimisticDealing]);

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

  const toastResultRecorded = useCallback(
    (resultData: unknown, resultIndex: number) => {
      const described = module.describeResult?.(resultData, rules) ?? String(resultData);
      toast.success(`${described} recorded · ${module.resultLabel} ${resultIndex}`, {
        testId: "dealer-toast",
      });
    },
    [module, rules, toast],
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
      betting.onDealerEntry();
      const nextIndex = getCurrentSeriesResults(composed.platform).length + 1;
      store.record(confirmState.result, { quick: false });
      toastResultRecorded(confirmState.result, nextIndex);
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
    composed.module,
    store,
    toastResultRecorded,
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
    const count = getCurrentSeriesResults(composed.platform).length;
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

  const handleNewSeries = useCallback(async () => {
    const ok = await confirm({
      title: `Start new ${module.seriesLabel}?`,
      confirmLabel: `New ${module.seriesLabel}`,
    });
    if (ok) {
      store.startNewSeries();
      setMenuOpen(false);
    }
  }, [confirm, module.seriesLabel, store]);

  const handleVoidOpenBets = useCallback(async () => {
    if (betsView.openBets.length === 0) return;
    const ok = await confirm({
      title: "Void open bets?",
      body: `Remove ${betsView.openBets.length} open bet(s)? Players' chips will be returned.`,
      destructive: true,
      confirmLabel: "Hold to void bets",
    });
    if (!ok) return;
    for (const bet of betsView.openBets) {
      store.emit({ type: "BET_REMOVED", betId: bet.id, by: "dealer" });
    }
    setMenuOpen(false);
  }, [betsView.openBets, confirm, store]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shouldIgnoreKeyboardShortcut(menuOpen)) return;
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
        void handleNewSeries();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmState?.enabled, handleNewSeries, handleUndo, menuOpen, startConfirmDelay]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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

  const handleExport = useCallback(
    async (opts?: { toastMessage?: string }) => {
      try {
        let text: string;
        const syncStoreForExport = isSyncStore(store) ? store : null;
        const dealerToken = syncStoreForExport?.getDealerToken() ?? null;

        if (syncStoreForExport && dealerToken) {
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

        const resultCount = countSeriesResults(store.events);
        const successMessage = opts?.toastMessage ?? `Export copied — ${resultCount} results`;
        try {
          await navigator.clipboard.writeText(text);
          toast.success(successMessage, { testId: "dealer-toast" });
          setMenuOpen(false);
        } catch {
          await prompt({
            title: "Export",
            label: "Copy this text manually",
            defaultValue: text,
            multiline: true,
            confirmLabel: "Done",
          });
          setMenuOpen(false);
        }
      } catch {
        toast.error("Export failed", { testId: "dealer-toast" });
      }
    },
    [
      composed.platform.participation.outcomeSource,
      module,
      prompt,
      rules,
      store,
      table.seriesNumber,
      toast,
    ],
  );

  useEffect(() => {
    if (sessionEnded && !prevSessionEndedRef.current) {
      void handleExport({ toastMessage: "Session ended — export copied" });
    }
    prevSessionEndedRef.current = sessionEnded;
  }, [handleExport, sessionEnded]);

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
    if (!("error" in envelope) && (envelope.players.length > 0 || envelope.bets.length > 0)) {
      toast.info(
        `${envelope.players.length} players, ${envelope.bets.length} bets in this export — not imported`,
        { testId: "dealer-toast" },
      );
    }
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
  const virtualPending = store.getVirtualPending?.() ?? null;

  useEffect(() => {
    if (!virtualPending) setForceTapped(false);
  }, [virtualPending]);

  useEffect(() => {
    resultCountRef.current = countSeriesResults(store.events);
    const unsub = store.subscribe(() => {
      const next = countSeriesResults(store.events);
      if (next > resultCountRef.current) {
        clearOptimisticDealing();
      }
      resultCountRef.current = next;
    });
    return () => {
      unsub();
      clearOptimisticDealing();
    };
  }, [store, clearOptimisticDealing]);

  useEffect(() => {
    if (!syncStore) return;
    const unsub = store.subscribe(() => {
      const reason = syncStore.getRejectReason();
      if (!reason) {
        lastToastedRejectRef.current = null;
        return;
      }
      if (reason === lastToastedRejectRef.current) return;
      lastToastedRejectRef.current = reason;
      toast.error(`Action failed — ${formatRejectReason(reason)}`, { testId: "dealer-toast" });
    });
    return unsub;
  }, [store, syncStore, toast]);

  const showForceBtn = virtualTable && virtualStatus?.awaiting === "action";
  const forceDisabled = readOnly || !!virtualPending || forceTapped;
  const forceLabel = virtualStatus?.turnPrompt
    ? `Force — skip ${virtualStatus.turnPrompt}`
    : `Force ${virtualTriggerLabel.toLowerCase()}`;

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
        {sessionEnded ? (
          <>
            <span class={dotClass} title={dotTitle} data-testid="connection-dot" />
            <span data-testid="dealer-session-ended-status">Session ended</span>
          </>
        ) : editingEnvelope ? (
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

      {sessionEnded ? (
        <SessionEndedPanel
          resultCount={resultCount}
          playerCount={activePlayerCount}
          chipsIssuedTotal={chipsIssuedTotal}
          topBankrolls={topBankrolls}
          virtualTable={virtualTable}
          {...(revealedSeed !== undefined ? { seedHex: revealedSeed } : {})}
          onCopyExport={() => void handleExport(undefined)}
          {...(onNewTable ? { onNewTable } : {})}
          onHome={() => route("/")}
        />
      ) : null}

      {!sessionEnded && playerModeOn && (
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

      {!sessionEnded && !virtualTable && (
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

      {!sessionEnded && virtualTable && (
        <VirtualPanel
          virtualPending={virtualPending}
          optimisticDealing={optimisticDealing}
          events={store.events}
          currentSeriesResults={composed.platform.currentSeriesResults}
          module={module}
          rules={rules}
          composed={composed}
          game={store.game}
          triggerLabel={virtualTriggerLabel}
        />
      )}

      <div class="dealer-shell__bottom" data-testid="dealer-bottom-bar">
        <div class="dealer-shell__toolbar">
          {!sessionEnded && playerModeOn && (
            <>
              <button
                type="button"
                class="dealer-shell__tool-btn dealer-shell__tool-btn--labeled"
                data-testid="players-btn"
                disabled={!syncStore}
                aria-label="Players"
                title={syncStore ? "Players" : "Local players are managed in the Solo page"}
                onClick={() => setActiveDialog("players")}
              >
                <span class="dealer-shell__tool-icon" aria-hidden="true">
                  👥
                </span>
                <span class="dealer-shell__tool-label">Players</span>
              </button>
              <button
                type="button"
                class="dealer-shell__tool-btn dealer-shell__tool-btn--labeled"
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
              class="dealer-shell__tool-btn dealer-shell__tool-btn--labeled"
              data-testid="menu-btn"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span class="dealer-shell__tool-icon" aria-hidden="true">
                ⚙
              </span>
              <span class="dealer-shell__tool-label">Menu</span>
            </button>
            {menuOpen && (
              <>
                <div
                  class="dealer-shell__menu-backdrop"
                  data-testid="menu-backdrop"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  ref={menuPanelRef}
                  class="dealer-shell__menu-panel"
                  role="menu"
                  data-testid="dealer-menu-panel"
                >
                  {!sessionEnded && onNewTable && (
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
                  {!sessionEnded && (
                    <>
                      <button
                        type="button"
                        data-testid="menu-new-series"
                        onClick={() => void handleNewSeries()}
                      >
                        New {module.seriesLabel}
                      </button>
                      <button
                        type="button"
                        data-testid="menu-void-bets"
                        disabled={betsView.openBets.length === 0}
                        onClick={() => void handleVoidOpenBets()}
                      >
                        Void open bets
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
                    </>
                  )}
                  <button type="button" onClick={() => void handleExport()}>
                    Export
                  </button>
                  {!sessionEnded && (
                    <button
                      type="button"
                      data-testid="menu-import"
                      onClick={() => void handleImport()}
                    >
                      Import
                    </button>
                  )}
                  <a href={tableUrl(`/verify?code=${store.code}`)} data-testid="menu-verify">
                    Verify fairness / export
                  </a>
                  {!sessionEnded && (
                    <>
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
                        data-testid="menu-calculator"
                        onClick={() => {
                          setActiveDialog("calculator");
                          setMenuOpen(false);
                        }}
                      >
                        Calculator
                      </button>
                    </>
                  )}
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

        {!sessionEnded && (
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
                    startOptimisticDealing();
                    store.sendVirtual("trigger");
                  }}
                >
                  {virtualTriggerLabel}
                </button>
                {showForceBtn && (
                  <button
                    type="button"
                    class="dealer-shell__btn"
                    disabled={forceDisabled}
                    data-testid="force-btn"
                    title="Deals now even though it is a player's turn"
                    onClick={() => {
                      setForceTapped(true);
                      startOptimisticDealing();
                      store.sendVirtual("force");
                    }}
                  >
                    {forceLabel}
                  </button>
                )}
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
                  {undoArmed
                    ? `Tap again to undo ${module.resultLabel} ${undoHand}`
                    : `Undo last ${module.resultLabel}`}
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
        )}
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
