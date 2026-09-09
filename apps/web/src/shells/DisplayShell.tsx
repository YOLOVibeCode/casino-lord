import { createElement } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import type { UntypedGameModule } from "../table/module-types.js";
import type { DeviceSettings } from "../settings/device-settings.js";
import { resolveLayout } from "../settings/device-settings.js";
import type { TableStore } from "../table/store.js";
import { useStore } from "../hooks/use-store.js";
import "./display-shell.css";

export interface DisplayShellProps {
  store: TableStore;
  module: UntypedGameModule;
  rules: unknown;
  deviceSettings: DeviceSettings;
}

export function DisplayShell({ store, module, rules, deviceSettings }: DisplayShellProps) {
  useStore(store);
  const composed = store.getComposed();
  const table = store.getTableMeta();
  const playerModeOn = composed.platform.participation.playerMode === "on";
  const layout = resolveLayout(module.layouts, deviceSettings.layoutId);
  const stats = module.stats(composed.module, rules);

  const [fsHint, setFsHint] = useState(!deviceSettings.fullScreen);
  const [infoOpen, setInfoOpen] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);
  const [cursorHidden, setCursorHidden] = useState(false);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const resetCursorTimer = () => {
    setCursorHidden(false);
    if (!deviceSettings.cursorHide) return;
    if (cursorTimer.current) clearTimeout(cursorTimer.current);
    cursorTimer.current = setTimeout(() => setCursorHidden(true), 3000);
  };

  useEffect(() => {
    resetCursorTimer();
    const el = rootRef.current;
    if (!el) return;
    el.addEventListener("mousemove", resetCursorTimer);
    return () => {
      el.removeEventListener("mousemove", resetCursorTimer);
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
    };
  }, [deviceSettings.cursorHide]);

  const requestFullScreen = async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      await el.requestFullscreen();
      setFsHint(false);
    } catch {
      setFsHint(false);
    }
  };

  const handleLogoTap = () => {
    const next = logoTaps + 1;
    setLogoTaps(next);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setLogoTaps(0), 2000);
    if (next >= 5) {
      setInfoOpen((o) => !o);
      setLogoTaps(0);
    }
  };

  const emptyBets = { round: null, summaries: [], openBets: [] };

  return (
    <div
      ref={rootRef}
      class={`display-shell${cursorHidden ? " display-shell--cursor-hidden" : ""}`}
      data-testid="display-shell"
      onClick={() => {
        if (fsHint) void requestFullScreen();
      }}
    >
      <header class="display-shell__header">
        <span
          class="display-shell__logo"
          onClick={(e) => {
            e.stopPropagation();
            handleLogoTap();
          }}
        >
          ♠ CASINO LORD
        </span>
        <span>{module.name}</span>
        <span>Table {store.code}</span>
        <span>
          {module.seriesLabel} {table.seriesNumber}
        </span>
        <div class="display-shell__stats">
          {stats.map((row) => (
            <span key={row.label}>
              {row.label}: <span class="display-shell__stat-value">{row.value}</span>
            </span>
          ))}
        </div>
      </header>

      {playerModeOn && (
        <div class="display-shell__betting-strip" data-testid="betting-strip">
          BETS OPEN
        </div>
      )}

      <div class="display-shell__module">
        {createElement(module.DisplayView as unknown as ComponentType<Record<string, unknown>>, {
          state: composed.module,
          rules,
          table,
          bets: emptyBets,
          layout,
        })}
      </div>

      {playerModeOn && (
        <aside class="display-shell__players" data-testid="players-panel">
          PLAYERS
        </aside>
      )}

      {fsHint && <div class="display-shell__fs-hint">Tap for full screen</div>}

      {infoOpen && (
        <div class="display-shell__info" onClick={(e) => e.stopPropagation()}>
          <div>Table: {store.code}</div>
          <div>Game: {module.name}</div>
          <div>Connection: Local / Solo</div>
          <div>Version: 0.0.0</div>
        </div>
      )}

      <div class="display-shell__animation-overlay" aria-hidden="true" />
    </div>
  );
}
