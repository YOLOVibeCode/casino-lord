import {
  buildLeaderboard,
  getBankroll,
  getCurrentRound,
  getRoundBets,
  getRoundSettlements,
  type BetCatalogue,
  type BetDef,
  type TableEvent,
} from "@casino-lord/core";
import {
  BetSlip,
  ChipTray,
  PlayerBettingContext,
  type BetSlipEntry,
  type PlayerBettingContextValue,
} from "@casino-lord/ui";
import { createElement, type ComponentType } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { validateBet, validatePlaceAll } from "../betting/validate-bet.js";
import { useCountUp } from "../hooks/use-count-up.js";
import { useStore } from "../hooks/use-store.js";
import { getGame } from "../table/games.js";
import type { TableStore } from "../table/store.js";
import { isSyncStore } from "../table/sync-store-types.js";
import "./player-shell.css";

export interface PlayerShellProps {
  store: TableStore;
  playerName: string;
}

interface PendingBet {
  clientId: string;
  type: string;
  label: string;
  amount: number;
}

type FooterTab = "play" | "history" | "leaderboard" | "rules" | "info";

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

export function PlayerShell({ store, playerName }: PlayerShellProps) {
  useStore(store);
  const composed = store.getComposed();
  const settings = composed.platform.settings;
  const rules = store.getRules();
  const moduleEntry = getGame(store.game);
  const module = moduleEntry?.module;

  const playerId = isSyncStore(store) ? store.getPlayerId() : null;
  const player = playerId ? composed.platform.players.find((p) => p.id === playerId) : undefined;

  const [selectedDenom, setSelectedDenom] = useState(() => settings.bank.chipDenominations[0] ?? 5);
  const [pendingBets, setPendingBets] = useState<PendingBet[]>([]);
  const [validationError, setValidationError] = useState("");
  const [activeTab, setActiveTab] = useState<FooterTab>("play");
  const [settlementFlash, setSettlementFlash] = useState<"win" | "lose" | null>(null);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const lastSettledRoundRef = useRef<string | null>(null);

  const round = getCurrentRound(composed.platform);
  const openRound = round?.status === "open" ? round : null;
  const bankroll = playerId ? getBankroll(composed.platform, playerId) : 0;
  const displayBankroll = useCountUp(bankroll);
  const houseBank = composed.platform.participation.bank === "house";

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

  useEffect(() => {
    if (!settledRound || settledRound.id === lastSettledRoundRef.current || !playerId) return;
    lastSettledRoundRef.current = settledRound.id;
    const settlements = getRoundSettlements(composed.platform, settledRound.id);
    const betById = new Map(composed.platform.bets.map((b) => [b.id, b]));
    let profit = 0;
    for (const s of settlements) {
      const bet = betById.get(s.betId);
      if (bet?.playerId === playerId) profit += s.profit;
    }
    if (profit > 0) setSettlementFlash("win");
    else if (profit < 0) setSettlementFlash("lose");
    const t = setTimeout(() => setSettlementFlash(null), 800);
    return () => clearTimeout(t);
  }, [composed.platform, playerId, settledRound]);

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

  useEffect(() => {
    if (!playerId || !isSyncStore(store)) return;
    let hiddenAt: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let markedAway = false;

    const onVis = (): void => {
      if (document.hidden) {
        hiddenAt = Date.now();
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
        hiddenAt = null;
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (timer) clearTimeout(timer);
    };
  }, [playerId, store]);

  const addPending = useCallback(
    (betType: string) => {
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
        setValidationError(result.reason ?? "Bet rejected");
        return;
      }

      setValidationError("");
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
    ],
  );

  const removeFromZone = useCallback(
    (betType: string) => {
      const pending = pendingBets.filter((b) => b.type === betType);
      if (pending.length > 0) {
        const last = pending[pending.length - 1]!;
        setPendingBets((prev) => prev.filter((b) => b.clientId !== last.clientId));
        setValidationError("");
        return;
      }
      const placed = placedBets.filter((b) => b.type === betType);
      if (placed.length > 0) {
        const last = placed[placed.length - 1]!;
        void store.emit({ type: "BET_REMOVED", betId: last.id });
      }
    },
    [pendingBets, placedBets, store],
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
      setValidationError(validation.reason ?? "Cannot place bets");
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
        },
      });
    }
    setPendingBets([]);
    setValidationError("");
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
  ]);

  const handleRemoveSlip = useCallback(
    (id: string, pending: boolean) => {
      if (pending) {
        setPendingBets((prev) => prev.filter((b) => b.clientId !== id));
      } else {
        void store.emit({ type: "BET_REMOVED", betId: id });
      }
      setValidationError("");
    },
    [store],
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
    if (openRound) {
      const cd = countdownSec !== null ? ` · 0:${String(countdownSec).padStart(2, "0")}` : "";
      return `BETS OPEN${cd}`;
    }
    if (round?.status === "closed") return "BETS CLOSED";
    if (settledRound && playerId) {
      const settlements = getRoundSettlements(composed.platform, settledRound.id);
      const betById = new Map(composed.platform.bets.map((b) => [b.id, b]));
      let profit = 0;
      for (const s of settlements) {
        const bet = betById.get(s.betId);
        if (bet?.playerId === playerId) profit += s.profit;
      }
      const mod = composed.module as {
        results?: { data: { outcome: string; bankerTotal: number; playerTotal: number } }[];
      };
      const last = mod.results?.at(-1)?.data;
      if (last && profit !== 0) {
        const label = last.outcome === "B" ? "Banker" : last.outcome === "P" ? "Player" : "Tie";
        const total = last.outcome === "B" ? last.bankerTotal : last.playerTotal;
        const sign = profit >= 0 ? "+" : "";
        const verb = profit >= 0 ? "won" : "lost";
        return `${label} ${total} — you ${verb} ${sign}${profit}`;
      }
    }
    return "BETS — idle";
  })();

  const buyInByPlayer = buildBuyInMap(store.events);
  const leaderboard = buildLeaderboard(composed.platform, buyInByPlayer);

  const historyRows = playerId
    ? composed.platform.bets
        .filter((b) => b.playerId === playerId)
        .map((b) => ({
          id: b.id,
          type: b.type,
          amount: b.amount,
          roundId: b.roundId,
        }))
    : [];

  const connection = isSyncStore(store) ? store.getConnectionState() : "offline";
  const dotClass =
    connection === "connected"
      ? "player-shell__dot player-shell__dot--on"
      : "player-shell__dot player-shell__dot--off";

  const noopPlace = useCallback(() => {}, []);
  const noopRemove = useCallback(() => {}, []);
  const noopAct = useCallback(() => {}, []);

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

  return (
    <div class="player-shell" data-testid="player-shell">
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
      </header>

      {houseBank && bankroll === 0 && (
        <p class="player-shell__rebuy" data-testid="player-rebuy-hint">
          Ask the dealer for chips
        </p>
      )}

      <div class="player-shell__status" data-testid="player-status-bar">
        {statusLine}
      </div>

      <PlayerBettingContext.Provider value={bettingContext}>
        {activeTab === "play" && (
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
                place: noopPlace,
                remove: noopRemove,
                act: noopAct,
              })}
            </main>
            <ChipTray
              denominations={settings.bank.chipDenominations}
              selected={selectedDenom}
              onSelect={setSelectedDenom}
              onClear={() => {
                setPendingBets([]);
                setValidationError("");
              }}
            />
            <BetSlip
              entries={slipEntries}
              total={pendingTotal + placedTotal}
              locked={!openRound}
              canPlace={!!openRound && pendingBets.length > 0}
              error={validationError}
              onRemove={handleRemoveSlip}
              onPlace={handlePlace}
            />
          </>
        )}

        {activeTab === "history" && (
          <div class="player-shell__panel" data-testid="player-history">
            <h2>History</h2>
            {historyRows.length === 0 && <p>No bets this session</p>}
            <ul>
              {historyRows.map((row) => (
                <li key={row.id}>
                  {row.type} — {row.amount} (round {row.roundId})
                </li>
              ))}
            </ul>
            {playerId && (
              <p>
                Net: {getBankroll(composed.platform, playerId) - (buyInByPlayer[playerId] ?? 0)}
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
    </div>
  );
}
