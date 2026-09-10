import {
  buildBetsView,
  buildLeaderboard,
  getBankroll,
  getCurrentRound,
  getSettlementTicker,
  sortPlayers,
  type PlatformState,
  type Settlement,
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
import { isSyncConfigured } from "../sync/config.js";
import { tableUrl } from "../sync/urls.js";
import { isSyncStore } from "../table/sync-store-types.js";
import type { TableStore } from "../table/store.js";
import { AnimationLayer } from "../animation/AnimationLayer.js";
import { animationSound } from "../animation/sound.js";
import { useAnimationRuntime } from "../animation/useAnimationRuntime.js";
import { useStore } from "../hooks/use-store.js";
import { currentSeriesCommit } from "../table/meta.js";
import { formatBoardLabel } from "../i18n/board-labels.js";
import { formatPlural } from "../i18n/plural.js";
import { BettingStrip } from "./BettingStrip.js";
import { LeaderboardInterstitial } from "./LeaderboardInterstitial.js";
import { describeResultLine } from "./PlayerShell.js";
import "./display-shell.css";

const HINT_DISMISS_MS = 8000;
const HINT_DISMISS_REDUCED_MS = 2000;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hintDismissMs(): number {
  return prefersReducedMotion() ? HINT_DISMISS_REDUCED_MS : HINT_DISMISS_MS;
}

function settlementsByBetId(settlements: PlatformState["settlements"]): Map<string, Settlement> {
  const map = new Map<string, Settlement>();
  for (const roundSettlements of Object.values(settlements)) {
    for (const s of roundSettlements) {
      map.set(s.betId, s);
    }
  }
  return map;
}

function countAffectedSettlements(
  before: PlatformState["settlements"],
  after: PlatformState["settlements"],
): number {
  const prev = settlementsByBetId(before);
  const next = settlementsByBetId(after);
  const ids = new Set([...prev.keys(), ...next.keys()]);
  let count = 0;
  for (const id of ids) {
    const a = prev.get(id);
    const b = next.get(id);
    if (!a || !b) {
      count++;
      continue;
    }
    if (a.outcome !== b.outcome || a.returned !== b.returned || a.profit !== b.profit) {
      count++;
    }
  }
  return count;
}

function isDealerAuthoredPersistedEvent(event: TableEvent): boolean {
  switch (event.type) {
    case "RESULT_RECORDED":
    case "BETS_OPENED":
    case "SETTINGS_CHANGED":
    case "SESSION_ENDED":
    case "DEALER_CHANGED":
    case "PLAYER_JOINED":
    case "PLAYER_UPDATED":
    case "PLAYER_REMOVED":
    case "BANK_ISSUED":
    case "BANK_ADJUSTED":
      return true;
    case "BETS_CLOSED":
      return event.by === "dealer";
    default:
      return false;
  }
}

export interface DisplayShellProps {
  store: TableStore;
  module: UntypedGameModule;
  rules: unknown;
  deviceSettings: DeviceSettings;
  syncBaseUrl?: string;
}

export function DisplayShell({
  store,
  module,
  rules,
  deviceSettings,
  syncBaseUrl,
}: DisplayShellProps) {
  useStore(store);
  const composed = store.getComposed();
  const table = store.getTableMeta();
  const playerModeOn = composed.platform.participation.playerMode === "on";
  const virtualTable = composed.platform.participation.outcomeSource === "virtual";
  const seriesCommit = virtualTable ? currentSeriesCommit(store.events) : null;
  const virtualPending = store.getVirtualPending?.() ?? null;
  const [pendingProgress, setPendingProgress] = useState(0);

  useEffect(() => {
    if (!virtualPending) {
      setPendingProgress(0);
      return;
    }
    const tick = (): void => {
      const remaining = Date.parse(virtualPending.untilAt) - Date.now();
      const total = Math.max(1, Date.parse(virtualPending.untilAt) - Date.now() + 1000);
      setPendingProgress(Math.max(0, Math.min(1, 1 - remaining / total)));
    };
    tick();
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [virtualPending?.untilAt]);
  const joiningOpen = composed.platform.settings.players?.joiningOpen ?? false;
  const sessionEnded = store.events.some((e) => e.type === "SESSION_ENDED");
  const bankHouse = playerModeOn && composed.platform.participation.bank === "house";
  const showBankrolls = bankHouse && composed.platform.settings.players.showBankrolls;
  const playUrl =
    playerModeOn && joiningOpen && !sessionEnded && isSyncConfigured()
      ? tableUrl(`/play/${store.code}`)
      : undefined;
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
  const latestEventSeq = store.events.at(-1)?.seq ?? 0;

  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardPersistent, setLeaderboardPersistent] = useState(false);
  const [historyToast, setHistoryToast] = useState<string | null>(null);
  const [idleAttractActive, setIdleAttractActive] = useState(false);
  const lastLeaderboardSeq = useRef(0);
  const lastEventSeq = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSettlementsRef = useRef(composed.platform.settlements);
  const historyToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setCountdownTick] = useState(0);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const lastAnnouncedResultId = useRef<string | null>(null);
  const countdownAnnouncedRef = useRef<{ roundId: string; at10: boolean; at5: boolean }>({
    roundId: "",
    at10: false,
    at5: false,
  });

  useEffect(() => {
    const triggerEvents = store.events.filter(
      (e: TableEvent) =>
        (e.type === "SERIES_ENDED" || e.type === "SESSION_ENDED") &&
        e.seq > lastLeaderboardSeq.current,
    );
    if (triggerEvents.length === 0) return;
    lastLeaderboardSeq.current = Math.max(...triggerEvents.map((e) => e.seq));
    const lastTrigger = triggerEvents.at(-1);
    setLeaderboardPersistent(lastTrigger?.type === "SESSION_ENDED");
    setShowLeaderboard(true);
  }, [latestEventSeq, store]);

  useEffect(() => {
    if (!showLeaderboard || leaderboardPersistent) return;
    const id = setTimeout(() => setShowLeaderboard(false), 15_000);
    return () => clearTimeout(id);
  }, [showLeaderboard, leaderboardPersistent]);

  useEffect(() => {
    const last = store.events.at(-1);
    if (last?.type === "RESULT_EDITED" || last?.type === "RESULT_UNDONE") {
      const affected = countAffectedSettlements(
        prevSettlementsRef.current,
        composed.platform.settlements,
      );
      if (affected > 0) {
        const betWord = formatPlural(affected, "bet", "bets");
        setHistoryToast(`History re-evaluated — ${affected} ${betWord} affected`);
        if (historyToastTimer.current) clearTimeout(historyToastTimer.current);
        historyToastTimer.current = setTimeout(() => setHistoryToast(null), 4000);
      }
    }
    prevSettlementsRef.current = composed.platform.settlements;
  }, [latestEventSeq, composed.platform.settlements]);

  useEffect(
    () => () => {
      if (historyToastTimer.current) clearTimeout(historyToastTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (latestEventSeq !== lastEventSeq.current) {
      lastEventSeq.current = latestEventSeq;
      setIdleAttractActive(false);
    }

    if (!deviceSettings.idleAttract) {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = null;
      return;
    }

    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdleAttractActive(true), 90_000);

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [latestEventSeq, deviceSettings.idleAttract]);

  const [fsHint, setFsHint] = useState(!deviceSettings.fullScreen);
  const [soundUnlocked, setSoundUnlocked] = useState(() => animationSound.isUnlocked());
  const [soundHintVisible, setSoundHintVisible] = useState(
    () => deviceSettings.soundEnabled && !animationSound.isUnlocked(),
  );
  const [infoOpen, setInfoOpen] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [version, setVersion] = useState("0.0.0");
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fsHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    const last = store.events.at(-1);
    if (last?.type !== "RESULT_RECORDED") return;
    const resultId = last.result.id;
    if (resultId === lastAnnouncedResultId.current) return;
    lastAnnouncedResultId.current = resultId;
    const resultNumber = store.events.filter((e) => e.type === "RESULT_RECORDED").length;
    const description =
      module.describeResult !== undefined
        ? module.describeResult(last.result.data, rules)
        : describeResultLine(module, rules, composed.module, resultId);
    setLiveAnnouncement(`${module.resultLabel} ${resultNumber}: ${description}`);
  }, [latestEventSeq, composed.module, module, rules, store]);

  useEffect(() => {
    if (round?.status !== "open" || !round.closesAt) return;
    const id = setInterval(() => setCountdownTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [round?.id, round?.status, round?.closesAt]);

  useEffect(() => {
    if (round?.status !== "open" || betting.countdownSec === null) return;
    if (countdownAnnouncedRef.current.roundId !== round.id) {
      countdownAnnouncedRef.current = { roundId: round.id, at10: false, at5: false };
    }
    const state = countdownAnnouncedRef.current;
    if (betting.countdownSec <= 10 && !state.at10) {
      state.at10 = true;
      setLiveAnnouncement("Bets close in 10 seconds");
    }
    if (betting.countdownSec <= 5 && !state.at5) {
      state.at5 = true;
      setLiveAnnouncement("Bets close in 5 seconds");
    }
  }, [round?.id, round?.status, betting.countdownSec]);

  useEffect(() => {
    if (!syncBaseUrl) return;
    void fetchVersion(syncBaseUrl).then(setVersion);
  }, [syncBaseUrl]);

  useEffect(() => {
    if (!fsHint) {
      if (fsHintTimer.current) clearTimeout(fsHintTimer.current);
      return;
    }
    fsHintTimer.current = setTimeout(() => setFsHint(false), hintDismissMs());
    return () => {
      if (fsHintTimer.current) clearTimeout(fsHintTimer.current);
    };
  }, [fsHint]);

  useEffect(() => {
    if (!deviceSettings.soundEnabled || soundUnlocked || !soundHintVisible) {
      if (soundHintTimer.current) clearTimeout(soundHintTimer.current);
      return;
    }
    soundHintTimer.current = setTimeout(() => setSoundHintVisible(false), hintDismissMs());
    return () => {
      if (soundHintTimer.current) clearTimeout(soundHintTimer.current);
    };
  }, [deviceSettings.soundEnabled, soundUnlocked, soundHintVisible]);

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
  const [connectionState, setConnectionState] = useState(
    () => syncStore?.getConnectionState() ?? "connected",
  );
  const [dealerEverPresent, setDealerEverPresent] = useState(false);

  useEffect(() => {
    if (!syncStore) {
      setConnectionState("connected");
      setDealerEverPresent(false);
      return;
    }
    const refreshSyncState = (): void => {
      setConnectionState(syncStore.getConnectionState());
      const dealersConnected = syncStore.getPresence().dealers > 0;
      const dealerInLog = store.events.some(isDealerAuthoredPersistedEvent);
      if (dealersConnected || dealerInLog) {
        setDealerEverPresent(true);
      }
    };
    refreshSyncState();
    return syncStore.subscribe(refreshSyncState);
  }, [syncStore, latestEventSeq, store.events]);

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
    composed.platform.players.filter((p) => p.status !== "removed"),
    composed.platform,
    settings.players.playersSort,
  );

  const connectionLabel =
    connectionState === "connected"
      ? syncStore
        ? "Connected"
        : "Local / Solo"
      : connectionState === "reconnecting"
        ? "Reconnecting"
        : "Offline";

  const dealerBanner =
    syncStore && syncStore.getPresence().dealers === 0 && connectionState === "connected"
      ? dealerEverPresent
        ? { message: "Dealer disconnected", variant: "disconnected" as const }
        : { message: "Waiting for the dealer to connect", variant: "waiting" as const }
      : null;

  return (
    <div
      ref={rootRef}
      class={`display-shell${cursorHidden ? " display-shell--cursor-hidden" : ""}${idleAttractActive ? " display-shell--idle-attract" : ""}`}
      data-testid="display-shell"
      onClick={() => {
        unlockSound();
        setSoundUnlocked(true);
        setSoundHintVisible(false);
        if (fsHint) void requestFullScreen();
      }}
    >
      <header class="display-shell__header">
        <button
          type="button"
          class="display-shell__logo"
          aria-label="Table info"
          onClick={(e) => {
            e.stopPropagation();
            handleLogoTap();
          }}
        >
          ♠ CASINO LORD
        </button>
        <span>{module.name}</span>
        <span>Table {store.code}</span>
        <span>
          {module.seriesLabel} {table.seriesNumber}
        </span>
        {virtualTable && seriesCommit && (
          <a
            class="display-shell__virtual-badge"
            data-testid="virtual-commit"
            href={tableUrl(`/verify?code=${store.code}`)}
          >
            VIRTUAL · FAIR · {seriesCommit.slice(0, 8)}
          </a>
        )}
        <div class="display-shell__stats">
          {stats.map((row) => (
            <span key={row.label}>
              {formatBoardLabel(row.label, deviceSettings.boardLanguage)}:{" "}
              <span class="display-shell__stat-value">{row.value}</span>
            </span>
          ))}
        </div>
        {playUrl && (
          <QrBadge
            url={playUrl}
            title="Join QR"
            tableCode={store.code}
            caption={`Scan to join · ${store.code}`}
          />
        )}
        {syncStore && connectionState === "reconnecting" && (
          <span class="display-shell__connection-pill" data-testid="connection-pill">
            Reconnecting…
          </span>
        )}
      </header>

      {syncStore && connectionState === "offline" && (
        <div class="display-shell__connection-banner" data-testid="connection-banner" role="status">
          Reconnecting to dealer — board may be behind
        </div>
      )}

      {dealerBanner && (
        <div
          class={`display-shell__dealer-hint${dealerBanner.variant === "waiting" ? " display-shell__dealer-hint--waiting" : ""}`}
          data-testid={
            dealerBanner.variant === "waiting" ? "dealer-waiting" : "dealer-disconnected"
          }
          role="status"
        >
          {dealerBanner.message}
        </div>
      )}

      {historyToast && (
        <div
          class="display-shell__toast display-shell__toast--info"
          data-testid="history-toast"
          role="alert"
        >
          {historyToast}
        </div>
      )}

      {playerModeOn && (
        <BettingStrip
          round={round ?? settledRound ?? null}
          betsView={betsView}
          countdownSec={betting.countdownSec}
          settlementTicker={settlementTicker}
          betTimerSec={settings.betting?.betTimerSec ?? 0}
        />
      )}

      <div
        class={`display-shell__module${boardShaking ? " display-shell__module--shake" : ""}`}
        data-road-fit={deviceSettings.roadFit ? "true" : "false"}
        data-board-language={deviceSettings.boardLanguage}
        style={boardShaking ? { "--anim-duration": `${shakeDurationMs}ms` } : undefined}
      >
        {virtualTable && (
          <span class="display-shell__virtual-board-tag" data-testid="virtual-board-tag">
            VIRTUAL
          </span>
        )}
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
          <h3 class="display-shell__players-title">PLAYERS</h3>
          <ul class="display-shell__players-list">
            {sortedPlayers.map((p) => {
              const connected = syncStore
                ?.getPresence()
                .players.some((entry) => entry.id === p.id && entry.connected);
              const away = p.status === "away" || (syncStore ? !connected : false);
              return (
                <li key={p.id} class="display-shell__player-row" data-testid={`player-row-${p.id}`}>
                  <span class="display-shell__player-dot" style={{ background: p.color }} />
                  <span class="display-shell__player-name">{p.name}</span>
                  {away && <span class="display-shell__player-away">away</span>}
                  {showBankrolls && (
                    <span class="display-shell__player-bankroll" data-testid="player-bankroll">
                      {getBankroll(composed.platform, p.id).toLocaleString()}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>
      )}

      {fsHint && (
        <div class="display-shell__hint-toast" data-testid="fs-hint" role="status">
          Tap for full screen
        </div>
      )}

      {deviceSettings.soundEnabled && !soundUnlocked && soundHintVisible && (
        <div class="display-shell__hint-toast" data-testid="sound-unlock-hint" role="status">
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
          persistent={leaderboardPersistent}
          onDismiss={() => setShowLeaderboard(false)}
        />
      )}

      {virtualPending && (
        <div class="display-shell__virtual-pending" data-testid="virtual-pending-ring">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="16" class="display-shell__pending-track" />
            <circle
              cx="18"
              cy="18"
              r="16"
              class="display-shell__pending-progress"
              stroke-dasharray={`${pendingProgress * 100} 100`}
            />
          </svg>
        </div>
      )}

      <div ref={overlayRef} class="display-shell__animation-overlay" aria-hidden="true">
        <AnimationLayer segments={activeSegments} />
      </div>

      <div
        class="display-shell__sr-live"
        data-testid="display-live-region"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveAnnouncement}
      </div>
    </div>
  );
}
