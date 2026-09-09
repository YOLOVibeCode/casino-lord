import { createElement } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import type { UntypedGameModule } from "../table/module-types.js";
import type { DeviceSettings } from "../settings/device-settings.js";
import type { TableStore } from "../table/store.js";
import { useStore } from "../hooks/use-store.js";
import { buildExportText } from "../table/export.js";
import { countSeries, currentSeriesStartedAt } from "../table/meta.js";
import "./dealer-shell.css";

export interface DealerShellProps {
  store: TableStore;
  module: UntypedGameModule;
  rules: unknown;
  deviceSettings: DeviceSettings;
  onNewTable?: () => void;
}

export function DealerShell({
  store,
  module,
  rules,
  deviceSettings,
  onNewTable,
}: DealerShellProps) {
  useStore(store);
  const composed = store.getComposed();
  const table = store.getTableMeta();
  const playerModeOn = composed.platform.participation.playerMode === "on";
  const confirmState = module.confirm(composed.module, rules);

  const [menuOpen, setMenuOpen] = useState(false);
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

  const executeConfirm = useCallback(() => {
    if (!confirmState?.enabled || !confirmState.result) return;
    if (deviceSettings.haptics && typeof navigator.vibrate === "function") {
      navigator.vibrate(10);
    }
    store.record(confirmState.result, { quick: false });
    clearConfirmTimer();
  }, [clearConfirmTimer, confirmState, deviceSettings.haptics, store]);

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
  }, [composed.module, store, undoArmed]);

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

  return (
    <div class="dealer-shell" data-testid="dealer-shell">
      <header class="dealer-shell__header">
        <span class="dealer-shell__dot" title="Local / Solo" />
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
        })}
      </div>

      <div class="dealer-shell__actions">
        <button type="button" class="dealer-shell__btn" onClick={handleUndo} data-testid="undo-btn">
          {undoArmed ? `Tap again to undo Hand ${undoHand}` : "UNDO"}
        </button>
        <button
          type="button"
          class="dealer-shell__btn dealer-shell__btn--confirm"
          style={confirmStyle}
          disabled={!confirmState?.enabled}
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
            {confirmState?.label ?? "CONFIRM"}
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
              <button type="button" disabled>
                Settings (coming soon)
              </button>
              <button type="button" disabled>
                History (coming soon)
              </button>
              <button type="button" disabled>
                Calculator (coming soon)
              </button>
              <button type="button" disabled>
                Show QR (coming soon)
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
