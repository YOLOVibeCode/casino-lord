import {
  buildBetsView,
  buildLeaderboard,
  getBankroll,
  getCurrentRound,
  getSettlementTicker,
  sortPlayers,
  type TableEvent,
} from "@casino-lord/core";
import { createElement } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import type { UntypedGameModule } from "../table/module-types.js";
import { useBettingRound } from "../betting/use-betting-round.js";
import type { DeviceSettings } from "../settings/device-settings.js";
import { resolveLayout } from "../settings/device-settings.js";
import { fetchVersion } from "../sync/api.js";
import { QrBadge } from "../sync/QrBadge.js";
import { isSyncStore } from "../table/sync-store-types.js";
import type { TableStore } from "../table/store.js";
import { AnimationLayer } from "../animation/AnimationLayer.js";
import { animationSound } from "../animation/sound.js";
import { useAnimationRuntime } from "../animation/useAnimationRuntime.js";
import { useStore } from "../hooks/use-store.js";
import { BettingStrip } from "./BettingStrip.js";
import { LeaderboardInterstitial } from "./LeaderboardInterstitial.js";
import "./display-shell.css";

export interface DisplayShellProps {
  store: TableStore;
  module: UntypedGameModule;
  rules: unknown;
  deviceSettings: DeviceSettings;
  displayQrUrl?: string;
  syncBaseUrl?: string;
}

export function DisplayShell({
  store,
  module,
  rules,
  deviceSettings,
  displayQrUrl,
  syncBaseUrl,
}: DisplayShellProps) {
  useStore(store);
  const composed = store.getComposed();
  const table = store.getTableMeta();
  const playerModeOn = composed.platform.participation.playerMode === "on";
  const bankHouse = playerModeOn && composed.platform.participation.bank === "house";
  const showBankrolls = composed.platform.settings.players.showBankrolls;
  const layout = resolveLayout(module.layouts, deviceSettings.layoutId);
  const stats = module.stats(composed.module, rules);
  const settings = composed.platform.settings;

  const betting = useBettingRound({
    store,
    composed,
    settings,
    editing: false,
    newRoundId: () => crypto.randomUUID(),
  });
  const betsView = buildBetsView(composed.platform, module, composed.module);
  const round = getCurrentRound(composed.platform);
  const settledRound = composed.platform.rounds.filter((r) => r.status === "settled").at(-1);
  const settlementTicker = settledRound
    ? getSettlementTicker(composed.platform, settledRound.id)
    : "";

  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const lastLeaderboardSeq = useRef(0);

  useEffect(() => {
    const triggerEvents = store.events.filter(
      (e: TableEvent) =>
        (e.type === "SERIES_ENDED" || e.type === "SESSION_ENDED") &&
        e.seq > lastLeaderboardSeq.current,
    );
    if (triggerEvents.length === 0) return;
    lastLeaderboardSeq.current = Math.max(...triggerEvents.map((e) => e.seq));
    setShowLeaderboard(true);
  }, [store.events]);

  const [fsHint, setFsHint] = useState(!deviceSettings.fullScreen);
  const [soundUnlocked, setSoundUnlocked] = useState(() => animationSound.isUnlocked());
  const [infoOpen, setInfoOpen] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [version, setVersion] = useState("0.0.0");
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { activeSegments, heldModuleState, boardShaking, shakeDurationMs, unlockSound } =
    useAnimationRuntime({
      store,
      module,
      rules,
      deviceSettings,
      overlayRef,
      enabled: deviceSettings.animations,
    });

  const displayModuleState = heldModuleState ?? composed.module;

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

  useEffect(() => {
    if (!syncBaseUrl) return;
    void fetchVersion(syncBaseUrl).then(setVersion);
  }, [syncBaseUrl]);

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

  const syncStore = isSyncStore(store) ? store : null;

  const buyInByPlayer: Record<string, number> = {};
  for (const e of store.events) {
    if (e.type === "BANK_ISSUED" && e.reason === "buyin") {
      buyInByPlayer[e.playerId] = (buyInByPlayer[e.playerId] ?? 0) + e.amount;
    }
  }
  const leaderboard = buildLeaderboard(composed.platform, buyInByPlayer);
  const topByBankroll = [...leaderboard].sort((a, b) => b.bankroll - a.bankroll).slice(0, 3);
  const topByNet = [...leaderboard].sort((a, b) => b.net - a.net).slice(0, 3);
  const sortedPlayers = sortPlayers(
    composed.platform.players,
    composed.platform,
    settings.players.playersSort,
  );

  const connectionLabel = syncStore
    ? syncStore.getConnectionState() === "connected"
      ? "Connected"
      : syncStore.getConnectionState() === "reconnecting"
        ? "Reconnecting"
        : "Offline"
    : "Local / Solo";

  const dealerHint =
    syncStore &&
    syncStore.getPresence().dealers === 0 &&
    syncStore.getConnectionState() === "connected"
      ? "Dealer disconnected"
      : null;

  return (
    <div
      ref={rootRef}
      class={`display-shell${cursorHidden ? " display-shell--cursor-hidden" : ""}`}
      data-testid="display-shell"
      onClick={() => {
        unlockSound();
        setSoundUnlocked(true);
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
        {displayQrUrl && <QrBadge url={displayQrUrl} />}
      </header>

      {dealerHint && (
        <div class="display-shell__dealer-hint" data-testid="dealer-disconnected">
          {dealerHint}
        </div>
      )}

      {playerModeOn && (
        <BettingStrip
          round={round ?? settledRound ?? null}
          betsView={betsView}
          countdownSec={betting.countdownSec}
          settlementTicker={settlementTicker}
        />
      )}

      <div
        class={`display-shell__module${boardShaking ? " display-shell__module--shake" : ""}`}
        data-road-fit={deviceSettings.roadFit ? "true" : "false"}
        style={boardShaking ? { "--anim-duration": `${shakeDurationMs}ms` } : undefined}
      >
        {createElement(module.DisplayView as unknown as ComponentType<Record<string, unknown>>, {
          state: displayModuleState,
          rules,
          table,
          bets: betsView,
          layout,
        })}
      </div>

      {playerModeOn && sortedPlayers.length > 0 && (
        <aside class="display-shell__players" data-testid="players-panel">
          <div class="display-shell__players-title">PLAYERS</div>
          <ul class="display-shell__players-list">
            {sortedPlayers.map((p) => (
              <li key={p.id} data-testid={`player-row-${p.id}`}>
                <span class="display-shell__player-name">{p.name}</span>
                {bankHouse && showBankrolls && (
                  <span class="display-shell__player-bankroll" data-testid="player-bankroll">
                    {getBankroll(composed.platform, p.id).toLocaleString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </aside>
      )}

      {fsHint && <div class="display-shell__fs-hint">Tap for full screen</div>}

      {deviceSettings.soundEnabled && !soundUnlocked && (
        <div class="display-shell__fs-hint" data-testid="sound-unlock-hint">
          Tap to enable sound
        </div>
      )}

      {infoOpen && (
        <div class="display-shell__info" onClick={(e) => e.stopPropagation()}>
          <div>Table: {store.code}</div>
          <div>Game: {module.name}</div>
          <div>Connection: {connectionLabel}</div>
          <div>Version: {version}</div>
        </div>
      )}

      {showLeaderboard && playerModeOn && (
        <LeaderboardInterstitial
          byBankroll={topByBankroll}
          byNet={topByNet}
          onDismiss={() => setShowLeaderboard(false)}
        />
      )}

      <div ref={overlayRef} class="display-shell__animation-overlay" aria-hidden="true">
        <AnimationLayer segments={activeSegments} />
      </div>
    </div>
  );
}
