import {
  buildLeaderboard,
  getBankroll,
  getCurrentRound,
  getRoundBets,
  getRoundSettlements,
  sortPlayers,
  type BetCatalogue,
  type BetDef,
  type PlacedBet,
  type PlatformState,
  type Settlement,
  type TableEvent,
} from "@casino-lord/core";
import {
  ActionButtons,
  BetSlip,
  ChipTray,
  PlayerBettingContext,
  type BetSlipEntry,
  type PlayerBettingContextValue,
} from "@casino-lord/ui";
import { createElement, type ComponentType } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { AnimationLayer } from "../animation/AnimationLayer.js";
import { useAnimationRuntime } from "../animation/useAnimationRuntime.js";
import { validateBet, validatePlaceAll } from "../betting/validate-bet.js";
import { useCountUp } from "../hooks/use-count-up.js";
import { useDeviceSettings } from "../hooks/use-device-settings.js";
import { useStore } from "../hooks/use-store.js";
import { shakeThresholdForSensitivity } from "../settings/device-settings.js";
import { tapHaptic } from "../settings/haptics.js";
import { tableUrl } from "../sync/urls.js";
import { PlayerSettingsSheet } from "./PlayerSettingsSheet.js";
import { getGame } from "../table/games.js";
import { currentSeriesCommit } from "../table/meta.js";
import type { TableStore } from "../table/store.js";
import { isSyncStore } from "../table/sync-store-types.js";
import { routePlayerAct } from "./player-act.js";
import "./player-shell.css";
import "./player-settings-sheet.css";

export interface PlayerShellProps {
  store: TableStore;
  playerName: string;
}

interface PendingBet {
  clientId: string;
  type: string;
  label: string;
  amount: number;
  target?: unknown;
}

interface PlaceBetPayload {
  playerId: string;
  roundId: string;
  type: string;
  amount: number;
  declared: boolean;
  working: boolean;
  originRoundId: string;
  target?: unknown;
}

type FooterTab = "play" | "history" | "leaderboard" | "rules" | "info";

const SETTLEMENT_DISPLAY_MS = 4000;

function findBetDef(
  catalogue: BetCatalogue<unknown, unknown, unknown, unknown>,
  type: string,
): BetDef<unknown, unknown, unknown> | undefined {
  for (const group of catalogue.groups) {
    const bet = group.bets.find((b) => b.id === type);
    if (bet) return bet;
  }
  return undefined;
}

function betLabel(
  catalogue: BetCatalogue<unknown, unknown, unknown, unknown>,
  type: string,
): string {
  return findBetDef(catalogue, type)?.label ?? type;
}

function buildBuyInMap(events: readonly TableEvent[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of events) {
    if (e.type === "BANK_ISSUED") {
      map[e.playerId] = (map[e.playerId] ?? 0) + e.amount;
    }
  }
  return map;
}

interface HistoryRow {
  id: string;
  label: string;
  amount: number;
  roundId: string;
  outcome: Settlement["outcome"] | null;
  profit: number | null;
  profitLabel: string | null;
  runningNet: number | null;
}

function formatProfitLabel(profit: number, declared: boolean): string {
  const sign = profit >= 0 ? "+" : "";
  if (declared) {
    return `would pay ${sign}${profit}`;
  }
  return `${sign}${profit}`;
}

export function buildHistoryRows(
  platform: PlatformState,
  playerId: string,
  catalogue: BetCatalogue<unknown, unknown, unknown, unknown>,
  declaredMode: boolean,
): HistoryRow[] {
  const bets = platform.bets
    .filter((b) => b.playerId === playerId)
    .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());

  let runningNet = 0;
  return bets.map((bet: PlacedBet) => {
    const round = platform.rounds.find((r) => r.id === bet.roundId);
    const settlements = platform.settlements[bet.roundId] ?? [];
    const settlement = settlements.find((s) => s.betId === bet.id);

    if (settlement && round?.status === "settled") {
      runningNet += settlement.profit;
      return {
        id: bet.id,
        label: betLabel(catalogue, bet.type),
        amount: bet.amount,
        roundId: bet.roundId,
        outcome: settlement.outcome,
        profit: settlement.profit,
        profitLabel: formatProfitLabel(settlement.profit, declaredMode),
        runningNet,
      };
    }

    return {
      id: bet.id,
      label: betLabel(catalogue, bet.type),
      amount: bet.amount,
      roundId: bet.roundId,
      outcome: null,
      profit: null,
      profitLabel: null,
      runningNet: null,
    };
  });
}

function sumSettlementProfit(platform: PlatformState, playerId: string): number {
  let total = 0;
  for (const settlements of Object.values(platform.settlements)) {
    for (const s of settlements) {
      const bet = platform.bets.find((b) => b.id === s.betId);
      if (bet?.playerId === playerId) {
        total += s.profit;
      }
    }
  }
  return total;
}

function buildSettlementSummary(
  outcome: string,
  playerTotal: number | null,
  bankerTotal: number | null,
  profit: number,
): string {
  const outcomeLabel = outcome === "B" ? "Banker" : outcome === "P" ? "Player" : "Tie";
  const total = outcome === "B" ? bankerTotal : outcome === "P" ? playerTotal : playerTotal;
  const sign = profit >= 0 ? "+" : "";
  const verb = profit >= 0 ? "won" : "lost";
  const headline = total !== null ? `${outcomeLabel} ${total}` : outcomeLabel;
  return `${headline} — you ${verb} ${sign}${profit}`;
}

export function PlayerShell({ store, playerName }: PlayerShellProps) {
  useStore(store);
  const [deviceSettings, setDeviceSettings] = useDeviceSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const composed = store.getComposed();
  const settings = composed.platform.settings;
  const rules = store.getRules();
  const moduleEntry = getGame(store.game);
  const module = moduleEntry?.module;

  const playerId = isSyncStore(store) ? store.getPlayerId() : null;
  const player = playerId ? composed.platform.players.find((p) => p.id === playerId) : undefined;

  const [selectedDenom, setSelectedDenom] = useState(() => settings.bank.chipDenominations[0] ?? 5);
  const [pendingBets, setPendingBets] = useState<PendingBet[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FooterTab>("play");
  const [settlementFlash, setSettlementFlash] = useState<"win" | "lose" | null>(null);
  const [settlementByZone, setSettlementByZone] = useState<Record<string, "win" | "lose">>({});
  const [settlementSummary, setSettlementSummary] = useState<string | null>(null);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const [turnCountdownSec, setTurnCountdownSec] = useState<number | null>(null);
  const lastSettledRoundRef = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settlementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const animationsEnabled = deviceSettings.animations && deviceSettings.phoneAnimations !== "off";
  const phoneMode = deviceSettings.phoneAnimations === "reduced";
  const shakeThreshold = shakeThresholdForSensitivity(deviceSettings.shakeSensitivity);

  const { activeSegments } = useAnimationRuntime({
    store,
    module,
    rules,
    deviceSettings,
    overlayRef,
    enabled: animationsEnabled,
    phoneMode,
  });

  const round = getCurrentRound(composed.platform);
  const openRound = round?.status === "open" ? round : null;
  const bankroll = playerId ? getBankroll(composed.platform, playerId) : 0;
  const displayBankroll = useCountUp(bankroll);
  const houseBank = composed.platform.participation.bank === "house";
  const virtualTable = composed.platform.participation.outcomeSource === "virtual";
  const seriesCommit = virtualTable ? currentSeriesCommit(store.events) : null;

  const placedBets =
    playerId && openRound
      ? getRoundBets(composed.platform, openRound.id).filter((b) => b.playerId === playerId)
      : [];

  const pendingTotal = pendingBets.reduce((s, b) => s + b.amount, 0);
  const placedTotal = placedBets.reduce((s, b) => s + b.amount, 0);

  const me = useMemo(
    () =>
      player && playerId
        ? {
            player,
            bankroll,
            openBets: placedBets,
          }
        : null,
    [player, playerId, bankroll, placedBets],
  );

  const settledRound = composed.platform.rounds.filter((r) => r.status === "settled").at(-1);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 4000);
  }, []);

  useEffect(() => {
    const roundId = settledRound?.id;
    if (!roundId || roundId === lastSettledRoundRef.current || !playerId) return;
    lastSettledRoundRef.current = roundId;

    const snapshot = store.getComposed();
    const settlements = getRoundSettlements(snapshot.platform, roundId);
    const betById = new Map(snapshot.platform.bets.map((b) => [b.id, b]));
    let profit = 0;
    const byZone: Record<string, "win" | "lose"> = {};
    for (const s of settlements) {
      const bet = betById.get(s.betId);
      if (bet?.playerId !== playerId) continue;
      profit += s.profit;
      if (s.profit > 0) byZone[bet.type] = "win";
      else if (s.profit < 0) byZone[bet.type] = "lose";
    }

    const mod = snapshot.module as {
      results?: {
        data: {
          outcome: string;
          bankerTotal: number | null;
          playerTotal: number | null;
        };
      }[];
    };
    const last = mod.results?.at(-1)?.data;

    if (last && profit !== 0) {
      const summary = buildSettlementSummary(
        last.outcome,
        last.playerTotal,
        last.bankerTotal,
        profit,
      );
      setSettlementSummary(summary);
      setSettlementFlash(profit > 0 ? "win" : "lose");
      setSettlementByZone(byZone);
      if (settlementTimer.current) clearTimeout(settlementTimer.current);
      settlementTimer.current = setTimeout(() => {
        setSettlementSummary(null);
        setSettlementFlash(null);
        setSettlementByZone({});
      }, SETTLEMENT_DISPLAY_MS);
    }

    return () => {
      if (settlementTimer.current) clearTimeout(settlementTimer.current);
    };
  }, [store, playerId, settledRound?.id]);

  useEffect(() => {
    if (!openRound?.closesAt) {
      setCountdownSec(null);
      return;
    }
    const tick = (): void => {
      const sec = Math.max(
        0,
        Math.ceil((new Date(openRound.closesAt!).getTime() - Date.now()) / 1000),
      );
      setCountdownSec(sec);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openRound?.closesAt, openRound?.id]);

  const turnInfo = module?.turn?.(composed.module) ?? null;
  const isMyTurn = turnInfo?.playerId === playerId;

  useEffect(() => {
    if (!isMyTurn || !turnInfo?.deadlineMs) {
      setTurnCountdownSec(null);
      return;
    }
    const tick = (): void => {
      const sec = Math.max(0, Math.ceil((turnInfo.deadlineMs! - Date.now()) / 1000));
      setTurnCountdownSec(sec);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isMyTurn, turnInfo?.deadlineMs, turnInfo?.playerId]);

  useEffect(() => {
    if (!playerId || !isSyncStore(store)) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let markedAway = false;

    const onVis = (): void => {
      if (document.hidden) {
        timer = setTimeout(() => {
          markedAway = true;
          void store.emit({
            type: "PLAYER_UPDATED",
            playerId,
            patch: { status: "away" },
          });
        }, 60_000);
      } else {
        if (timer) clearTimeout(timer);
        if (markedAway) {
          void store.emit({
            type: "PLAYER_UPDATED",
            playerId,
            patch: { status: "active" },
          });
          markedAway = false;
        }
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (timer) clearTimeout(timer);
    };
  }, [playerId, store]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const hapticTap = useCallback(() => {
    tapHaptic(deviceSettings.haptics);
  }, [deviceSettings.haptics]);

  const addPending = useCallback(
    (betType: string) => {
      hapticTap();
      if (!module || !playerId || !openRound || !me) return;
      const betDef = findBetDef(module.bets, betType);
      if (!betDef) return;

      const result = validateBet({
        betDef,
        settings,
        rules,
        round: openRound,
        bankroll,
        amount: selectedDenom,
        pendingTotal: pendingTotal + placedTotal,
        moduleState: composed.module,
        me: { id: playerId, bankroll },
        houseBank,
      });

      if (!result.ok) {
        showToast(result.reason ?? "Bet rejected");
        return;
      }

      setPendingBets((prev) => [
        ...prev,
        {
          clientId: crypto.randomUUID(),
          type: betType,
          label: betLabel(module.bets, betType),
          amount: selectedDenom,
        },
      ]);
    },
    [
      module,
      playerId,
      openRound,
      me,
      settings,
      rules,
      bankroll,
      selectedDenom,
      pendingTotal,
      placedTotal,
      composed.module,
      houseBank,
      showToast,
      hapticTap,
    ],
  );

  const removeFromZone = useCallback(
    (betType: string) => {
      hapticTap();
      const pending = pendingBets.filter((b) => b.type === betType);
      if (pending.length > 0) {
        const last = pending[pending.length - 1]!;
        setPendingBets((prev) => prev.filter((b) => b.clientId !== last.clientId));
        return;
      }
      const placed = placedBets.filter((b) => b.type === betType);
      if (placed.length > 0) {
        const last = placed[placed.length - 1]!;
        void store.emit({ type: "BET_REMOVED", betId: last.id });
      }
    },
    [pendingBets, placedBets, store, hapticTap],
  );

  const handlePlace = useCallback(() => {
    if (!module || !playerId || !openRound) return;
    const toPlace = pendingBets.map((p) => ({
      betDef: findBetDef(module.bets, p.type)!,
      amount: p.amount,
      pending: p,
    }));

    const validation = validatePlaceAll(
      toPlace.map((t) => ({ betDef: t.betDef, amount: t.amount })),
      {
        settings,
        rules,
        round: openRound,
        bankroll,
        pendingTotal: placedTotal,
        moduleState: composed.module,
        me: { id: playerId, bankroll },
        houseBank,
      },
    );

    if (!validation.ok) {
      showToast(validation.reason ?? "Cannot place bets");
      return;
    }

    const now = new Date().toISOString();
    const declared = !houseBank;
    for (const item of toPlace) {
      void store.emit({
        type: "BET_PLACED",
        bet: {
          id: crypto.randomUUID(),
          playerId,
          roundId: openRound.id,
          type: item.pending.type,
          amount: item.pending.amount,
          declared,
          working: false,
          placedAt: now,
          originRoundId: openRound.id,
          ...(item.pending.target !== undefined ? { target: item.pending.target } : {}),
        },
      });
    }
    setPendingBets([]);
  }, [
    module,
    playerId,
    openRound,
    pendingBets,
    settings,
    rules,
    bankroll,
    placedTotal,
    composed.module,
    houseBank,
    store,
    showToast,
  ]);

  const handleRemoveSlip = useCallback(
    (id: string, pending: boolean) => {
      if (pending) {
        setPendingBets((prev) => prev.filter((b) => b.clientId !== id));
      } else {
        void store.emit({ type: "BET_REMOVED", betId: id });
      }
    },
    [store],
  );

  const handlePlaceBet = useCallback(
    (payload: PlaceBetPayload) => {
      hapticTap();
      if (!module || !playerId || !openRound || !me) return;
      if (payload.playerId !== playerId) return;

      const betDef = findBetDef(module.bets, payload.type);
      if (!betDef) return;

      const result = validateBet({
        betDef,
        settings,
        rules,
        round: openRound,
        bankroll,
        amount: payload.amount,
        pendingTotal: placedTotal,
        moduleState: composed.module,
        me: { id: playerId, bankroll },
        houseBank,
      });

      if (!result.ok) {
        showToast(result.reason ?? "Bet rejected");
        return;
      }

      void store.emit({
        type: "BET_PLACED",
        bet: {
          id: crypto.randomUUID(),
          playerId,
          roundId: openRound.id,
          type: payload.type,
          amount: payload.amount,
          declared: payload.declared,
          working: payload.working,
          placedAt: new Date().toISOString(),
          originRoundId: payload.originRoundId,
          ...(payload.target !== undefined ? { target: payload.target } : {}),
        },
      });
    },
    [
      module,
      playerId,
      openRound,
      me,
      settings,
      rules,
      bankroll,
      placedTotal,
      composed.module,
      houseBank,
      store,
      showToast,
      hapticTap,
    ],
  );

  const handleRemoveBet = useCallback(
    (betId: string) => {
      hapticTap();
      if (pendingBets.some((b) => b.clientId === betId)) {
        setPendingBets((prev) => prev.filter((b) => b.clientId !== betId));
        return;
      }
      void store.emit({ type: "BET_REMOVED", betId });
    },
    [pendingBets, store, hapticTap],
  );

  const handleAct = useCallback(
    (action: unknown) => {
      if (!playerId) return;
      hapticTap();
      routePlayerAct({
        game: store.game,
        action,
        playerId,
        virtualTable,
        isMyTurn,
        store,
        composed,
        emit: store.emit,
      });
    },
    [playerId, store, virtualTable, isMyTurn, composed, hapticTap],
  );

  const handleSelectSeat = useCallback(
    (seat: number) => {
      if (!playerId) return;
      hapticTap();
      void store.emit({
        type: "PLAYER_UPDATED",
        playerId,
        patch: { seat },
      });
    },
    [playerId, store, hapticTap],
  );

  const handleSelectDenom = useCallback(
    (denom: number) => {
      hapticTap();
      setSelectedDenom(denom);
    },
    [hapticTap],
  );

  const getOwnStake = useCallback(
    (zoneId: string) => {
      const pending = pendingBets
        .filter((b) => b.type === zoneId)
        .reduce((s, b) => s + b.amount, 0);
      const placed = placedBets.filter((b) => b.type === zoneId).reduce((s, b) => s + b.amount, 0);
      return pending + placed;
    },
    [pendingBets, placedBets],
  );

  const getTableStake = useCallback(
    (zoneId: string) => {
      if (!openRound) return 0;
      return getRoundBets(composed.platform, openRound.id)
        .filter((b) => b.type === zoneId)
        .reduce((s, b) => s + b.amount, 0);
    },
    [composed.platform, openRound],
  );

  const bettingContext: PlayerBettingContextValue | null =
    player && playerId
      ? {
          selectedDenomination: selectedDenom,
          showOthersBets: settings.players.showOthersBets,
          playerColor: player.color,
          getOwnStake,
          getTableStake,
          settlementFlash,
          settlementByZone,
          onZoneTap: addPending,
          onZoneLongPress: removeFromZone,
        }
      : null;

  const slipEntries: BetSlipEntry[] = [
    ...pendingBets.map((b) => ({
      id: b.clientId,
      label: b.label,
      amount: b.amount,
      pending: true,
    })),
    ...placedBets.map((b) => ({
      id: b.id,
      label: betLabel(module?.bets ?? { groups: [], summary: () => [] }, b.type),
      amount: b.amount,
      pending: false,
    })),
  ];

  const statusLine = ((): string => {
    if (settlementSummary) return settlementSummary;
    if (isMyTurn && turnInfo) return turnInfo.prompt;
    if (openRound) {
      const cd = countdownSec !== null ? ` · 0:${String(countdownSec).padStart(2, "0")}` : "";
      return `BETS OPEN${cd}`;
    }
    if (round?.status === "closed") return "BETS CLOSED";
    return "BETS — idle";
  })();

  const buyInByPlayer = buildBuyInMap(store.events);
  const leaderboard = buildLeaderboard(composed.platform, buyInByPlayer);
  const sessionEnded = store.events.some((e) => e.type === "SESSION_ENDED");
  const chipsIssued = playerId ? (buyInByPlayer[playerId] ?? 0) : 0;
  const sessionNet = houseBank
    ? bankroll - chipsIssued
    : playerId
      ? sumSettlementProfit(composed.platform, playerId)
      : 0;
  const leaderboardRank =
    playerId && settings.players.showBankrolls
      ? sortPlayers(
          composed.platform.players,
          composed.platform,
          settings.players.playersSort,
        ).findIndex((p) => p.id === playerId) + 1
      : null;

  const historyRows = useMemo(
    () =>
      playerId && module
        ? buildHistoryRows(composed.platform, playerId, module.bets, !houseBank)
        : [],
    [composed.platform, playerId, module, houseBank],
  );

  const connection = isSyncStore(store) ? store.getConnectionState() : "offline";
  const dotClass =
    connection === "connected"
      ? "player-shell__dot player-shell__dot--on"
      : "player-shell__dot player-shell__dot--off";

  if (!module || !me || !bettingContext) {
    return (
      <div class="player-shell" data-testid="player-shell">
        <p>Loading…</p>
      </div>
    );
  }

  const PlayerView = module.PlayerView as unknown as ComponentType<Record<string, unknown>>;
  const RulesView = module.RulesSettingsView as unknown as ComponentType<{
    rules: unknown;
    onChange: (patch: unknown) => void;
  }>;

  const playerActions = module.playerActions ?? [];

  return (
    <div class="player-shell" data-testid="player-shell">
      <div ref={overlayRef} class="player-shell__animation-overlay" aria-hidden="true">
        <AnimationLayer segments={activeSegments} />
      </div>

      <header class="player-shell__header">
        <span
          class="player-shell__colour"
          style={{ background: player!.color }}
          data-testid="player-colour-dot"
        />
        <span class={dotClass} data-testid="connection-dot" />
        <span class="player-shell__name">{playerName}</span>
        <span class="player-shell__bank" data-testid="player-bankroll">
          ⛁ {displayBankroll.toLocaleString()}
        </span>
        <span class="player-shell__code">{store.code}</span>
        <button
          type="button"
          class="player-shell__settings"
          aria-label="Settings"
          data-testid="player-settings-open"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
        </button>
      </header>

      {houseBank && bankroll === 0 && (
        <p class="player-shell__rebuy" data-testid="player-rebuy-hint">
          Ask the dealer for chips
        </p>
      )}

      <div class="player-shell__status" data-testid="player-status-bar">
        {sessionEnded ? "Session ended" : statusLine}
      </div>

      <PlayerBettingContext.Provider value={bettingContext}>
        {sessionEnded && (
          <div
            class="player-shell__panel player-shell__session-summary"
            data-testid="player-session-summary"
          >
            <h2>Session summary</h2>
            <dl class="player-shell__summary-stats">
              <dt>Chips issued</dt>
              <dd data-testid="player-session-issued">{chipsIssued.toLocaleString()}</dd>
              <dt>Net</dt>
              <dd data-testid="player-session-net">
                {sessionNet >= 0 ? "+" : ""}
                {sessionNet.toLocaleString()}
              </dd>
              <dt>Final bankroll</dt>
              <dd data-testid="player-session-bankroll">{bankroll.toLocaleString()}</dd>
              {leaderboardRank !== null && leaderboardRank > 0 && (
                <>
                  <dt>Leaderboard rank</dt>
                  <dd data-testid="player-session-rank">#{leaderboardRank}</dd>
                </>
              )}
            </dl>
            {virtualTable && (
              <a
                href={tableUrl(`/verify?code=${store.code}`)}
                class="player-shell__verify-link"
                data-testid="player-session-verify-link"
              >
                Verify fairness
              </a>
            )}
          </div>
        )}

        {activeTab === "play" && !sessionEnded && (
          <>
            <main class="player-shell__main">
              {createElement(PlayerView, {
                state: composed.module,
                rules,
                me,
                round:
                  round ??
                  ({
                    id: "idle",
                    status: "settled",
                    openedAt: new Date().toISOString(),
                  } as const),
                place: handlePlaceBet,
                remove: handleRemoveBet,
                act: handleAct,
                shakeThreshold,
                selectSeat: handleSelectSeat,
                seatAssign: module.seats?.assign,
                players: composed.platform.players,
              })}
            </main>

            <div class="player-shell__bottom" data-testid="player-bottom-bar">
              {toastMsg && (
                <div class="player-shell__toast" data-testid="player-toast" role="alert">
                  <span>{toastMsg}</span>
                  <button
                    type="button"
                    class="player-shell__toast-dismiss"
                    aria-label="Dismiss"
                    onClick={() => setToastMsg(null)}
                  >
                    ✕
                  </button>
                </div>
              )}

              {isMyTurn && playerActions.length > 0 && (
                <ActionButtons
                  actions={playerActions.map((a) => ({
                    id: a.id,
                    label: a.label,
                    enabled: a.enabled?.(composed.module, me) ?? true,
                    action: a.action,
                  }))}
                  countdownSec={turnCountdownSec}
                  onAction={handleAct}
                />
              )}

              <ChipTray
                denominations={settings.bank.chipDenominations}
                selected={selectedDenom}
                onSelect={handleSelectDenom}
                onClear={() => setPendingBets([])}
              />
              <BetSlip
                entries={slipEntries}
                total={pendingTotal + placedTotal}
                locked={!openRound}
                canPlace={!!openRound && pendingBets.length > 0}
                onRemove={handleRemoveSlip}
                onPlace={handlePlace}
              />
            </div>
          </>
        )}

        {activeTab === "history" && (
          <div class="player-shell__panel" data-testid="player-history">
            <h2>History</h2>
            {historyRows.length === 0 && <p>No bets this session</p>}
            <ul class="player-shell__history-list">
              {historyRows.map((row) => (
                <li
                  key={row.id}
                  class="player-shell__history-row"
                  data-testid={`player-history-row-${row.id}`}
                >
                  <span class="player-shell__history-label">
                    {row.label} — {row.amount}
                  </span>
                  {row.outcome !== null && (
                    <span
                      class={`player-shell__history-outcome player-shell__history-outcome--${row.outcome}`}
                      data-testid={`player-history-outcome-${row.id}`}
                    >
                      {row.outcome}
                    </span>
                  )}
                  {row.profitLabel !== null && (
                    <span
                      class="player-shell__history-profit"
                      data-testid={`player-history-profit-${row.id}`}
                    >
                      {row.profitLabel}
                    </span>
                  )}
                  {row.runningNet !== null && (
                    <span
                      class="player-shell__history-net"
                      data-testid={`player-history-running-net-${row.id}`}
                    >
                      net {row.runningNet >= 0 ? "+" : ""}
                      {row.runningNet}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {playerId && historyRows.some((r) => r.runningNet !== null) && (
              <p class="player-shell__history-total" data-testid="player-history-total-net">
                Session net:{" "}
                {[...historyRows].reverse().find((r) => r.runningNet !== null)?.runningNet ?? 0}
              </p>
            )}
          </div>
        )}

        {activeTab === "leaderboard" && settings.players.showBankrolls && (
          <div class="player-shell__panel" data-testid="player-leaderboard">
            <h2>Leaderboard</h2>
            <ul>
              {leaderboard.map((e) => (
                <li key={e.playerId}>
                  {e.name} — {e.bankroll} (net {e.net >= 0 ? "+" : ""}
                  {e.net})
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === "rules" && (
          <div class="player-shell__panel player-shell__panel--readonly" data-testid="player-rules">
            <RulesView rules={rules} onChange={() => {}} />
          </div>
        )}

        {activeTab === "info" && (
          <div class="player-shell__panel" data-testid="player-info">
            <p>Play chips only — no cash value</p>
            {virtualTable && seriesCommit && (
              <p class="player-shell__fairness" data-testid="player-fairness-commit">
                Fairness commitment: {seriesCommit.slice(0, 16)}…
              </p>
            )}
          </div>
        )}
      </PlayerBettingContext.Provider>

      <footer class="player-shell__footer">
        <button
          type="button"
          class={`player-shell__tab${activeTab === "history" ? " player-shell__tab--active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
        {settings.players.showBankrolls && (
          <button
            type="button"
            class={`player-shell__tab${activeTab === "leaderboard" ? " player-shell__tab--active" : ""}`}
            onClick={() => setActiveTab("leaderboard")}
          >
            Leaderboard
          </button>
        )}
        <button
          type="button"
          class={`player-shell__tab${activeTab === "rules" ? " player-shell__tab--active" : ""}`}
          onClick={() => setActiveTab("rules")}
        >
          Rules
        </button>
        <button
          type="button"
          class={`player-shell__tab${activeTab === "info" ? " player-shell__tab--active" : ""}`}
          aria-label="Information"
          onClick={() => setActiveTab("info")}
        >
          ℹ
        </button>
        {activeTab !== "play" && (
          <button
            type="button"
            class="player-shell__tab player-shell__tab--back"
            onClick={() => setActiveTab("play")}
          >
            ← Bets
          </button>
        )}
      </footer>

      {settingsOpen && (
        <PlayerSettingsSheet
          settings={deviceSettings}
          onChange={(patch) => setDeviceSettings({ ...deviceSettings, ...patch })}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
