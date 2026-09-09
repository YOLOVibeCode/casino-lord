import { createElement } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import type { ResultEnvelope } from "@casino-lord/core";
import type { UntypedGameModule } from "../table/module-types.js";
import type { DeviceSettings } from "../settings/device-settings.js";
import { QrDialog } from "../sync/QrDialog.js";
import { tableUrl } from "../sync/urls.js";
import { isSyncStore } from "../table/sync-store-types.js";
import type { TableStore } from "../table/store.js";
import { useStore } from "../hooks/use-store.js";
import { buildExportText } from "../table/export.js";
import { countSeries, currentSeriesStartedAt } from "../table/meta.js";
import { SettingsDialog } from "./SettingsDialog.js";
import { HistoryDialog } from "./HistoryDialog.js";
import { CalculatorDialog } from "./CalculatorDialog.js";
import "./dealer-shell.css";

export interface DealerShellProps {
  store: TableStore;
  module: UntypedGameModule;
  rules: unknown;
  deviceSettings: DeviceSettings;
  onDeviceSettingsChange: (settings: DeviceSettings) => void;
  onNewTable?: () => void;
}

type ActiveDialog = "settings" | "history" | "calculator" | "qr" | null;

export function DealerShell({
  store,
  module,
  rules,
  deviceSettings,
  onDeviceSettingsChange,
  onNewTable,
}: DealerShellProps) {
  useStore(store);
  const composed = store.getComposed();
  const table = store.getTableMeta();
  const playerModeOn = composed.platform.participation.playerMode === "on";
  const confirmState = module.confirm(composed.module, rules);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [editingEnvelope, setEditingEnvelope] = useState<ResultEnvelope<unknown> | null>(null);
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
    if (deviceSettings.haptics && typeof navigator.vibrate === "function") {
      navigator.vibrate(10);
    }
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
      store.record(confirmState.result, { quick: false });
      if (confirmState.autoSeries) {
        store.startNewSeries(undefined, { auto: true });
      }
    }
    clearConfirmTimer();
  }, [clearConfirmTimer, confirmState, deviceSettings.haptics, editingEnvelope, module.id, store]);

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
    const results =
      (composed.module as { results?: { id: string; data: unknown }[] }).results ?? [];
    const series = {
      id: composed.platform.currentSeriesId ?? "local",
      number: countSeries([...store.events]),
      startedAt: currentSeriesStartedAt([...store.events]),
      results: results.map((r, i) => ({
        id: r.id,
        index: i,
        recordedAt:
          store.events.find((e) => e.type === "RESULT_RECORDED" && e.result.id === r.id)?.at ?? "",
        quick: false,
        source: "physical" as const,
        by: "dealer" as const,
        data: r.data,
      })),
      rounds: [],
    };
    const text = buildExportText({
      game: store.game,
      code: store.code,
      seriesNumber: table.seriesNumber,
      seriesStartedAt: series.startedAt,
      source: "physical",
      rules,
      module,
      series,
    });
    await navigator.clipboard.writeText(text);
    setMenuOpen(false);
  };

  const handleImport = () => {
    const text = window.prompt("Paste series import text:");
    if (!text) return;
    const imported = module.importSeries(text, rules);
    if ("error" in imported) {
      window.alert(imported.error);
      return;
    }
    store.importResults(imported.results);
    if (imported.warnings.length > 0) {
      window.alert(imported.warnings.join("\n"));
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
          </>
        )}
      </header>

      {playerModeOn && (
        <div class="dealer-shell__betting-bar" data-testid="betting-bar">
          BETS — player mode
        </div>
      )}

      <div class="dealer-shell__module">
        {createElement(module.DealerView as unknown as ComponentType<Record<string, unknown>>, {
          state: composed.module,
          rules,
          table,
          emit: store.emit,
          record: store.record,
          autoAdvance: deviceSettings.autoAdvance,
          expressMode: deviceSettings.expressMode,
          editMode,
        })}
      </div>

      <div class="dealer-shell__actions">
        <button
          type="button"
          class="dealer-shell__btn"
          onClick={handleUndo}
          disabled={!!editingEnvelope || readOnly}
          data-testid="undo-btn"
        >
          {undoArmed ? `Tap again to undo Hand ${undoHand}` : "UNDO"}
        </button>
        <button
          type="button"
          class="dealer-shell__btn dealer-shell__btn--confirm"
          style={confirmStyle}
          disabled={!confirmState?.enabled || readOnly}
          onClick={startConfirmDelay}
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
      </div>

      <footer class="dealer-shell__footer">
        {playerModeOn && (
          <>
            <button type="button" disabled title="Coming soon">
              👥
            </button>
            <button type="button" disabled title="Coming soon">
              🏦
            </button>
          </>
        )}
        <div class="dealer-shell__menu">
          <button type="button" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>
            ⚙
          </button>
          {menuOpen && (
            <div class="dealer-shell__menu-panel">
              {onNewTable && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Start a new table?")) {
                      onNewTable();
                      setMenuOpen(false);
                    }
                  }}
                >
                  New Table
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Start new ${module.seriesLabel}?`)) {
                    store.startNewSeries();
                    setMenuOpen(false);
                  }
                }}
              >
                New {module.seriesLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("End session?")) {
                    store.endSession();
                    setMenuOpen(false);
                  }
                }}
              >
                End Session
              </button>
              <button type="button" onClick={() => void handleExport()}>
                Export
              </button>
              <button type="button" onClick={handleImport}>
                Import
              </button>
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
            </div>
          )}
        </div>
      </footer>

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
