import {
  getClosedRound,
  getCurrentRound,
  type ComposedState,
  type TableSettings,
} from "@casino-lord/core";
import { useCallback, useEffect, useRef } from "preact/hooks";
import type { TableStore } from "../table/store.js";

export interface BettingClock {
  nowMs: () => number;
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
}

export const defaultClock: BettingClock = {
  nowMs: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};

export interface UseBettingRoundOptions {
  store: TableStore;
  composed: ComposedState<unknown>;
  settings: TableSettings;
  editing: boolean;
  newRoundId: () => string;
  clock?: BettingClock;
}

export function useBettingRound({
  store,
  composed,
  settings,
  editing,
  newRoundId,
  clock = defaultClock,
}: UseBettingRoundOptions) {
  const autoOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const betTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSettledRound = useRef<string | null>(null);

  const bettingSettings = settings.betting ?? {
    betTimerSec: 0,
    autoOpenDelayMs: 3000,
    autoCloseOnEntry: true,
  };
  const round = getCurrentRound(composed.platform);
  const closedRound = getClosedRound(composed.platform);

  const clearTimers = useCallback(() => {
    if (autoOpenTimer.current) clock.clearTimeout(autoOpenTimer.current);
    if (betTimer.current) clock.clearTimeout(betTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    autoOpenTimer.current = null;
    betTimer.current = null;
    countdownInterval.current = null;
  }, [clock]);

  const openBets = useCallback(() => {
    if (round?.status === "open") return;
    const roundId = newRoundId();
    const betTimerSec = bettingSettings.betTimerSec;
    const closesAt =
      betTimerSec > 0 ? new Date(clock.nowMs() + betTimerSec * 1000).toISOString() : undefined;
    store.emit({
      type: "BETS_OPENED",
      roundId,
      ...(closesAt !== undefined ? { closesAt } : {}),
    });
  }, [bettingSettings.betTimerSec, clock, newRoundId, round?.status, store]);

  const closeBets = useCallback(
    (by: "dealer" | "timer" | "auto") => {
      if (!round || round.status !== "open") return;
      store.emit({ type: "BETS_CLOSED", roundId: round.id, by });
    },
    [round, store],
  );

  const closeBetsIfOpen = useCallback(
    (by: "dealer" | "timer" | "auto") => {
      const current = getCurrentRound(store.getComposed().platform);
      if (current?.status === "open") {
        store.emit({ type: "BETS_CLOSED", roundId: current.id, by });
      }
    },
    [store],
  );

  useEffect(() => {
    const settled = composed.platform.rounds.filter((r) => r.status === "settled");
    const latest = settled[settled.length - 1];
    if (!latest || latest.id === lastSettledRound.current) return;
    lastSettledRound.current = latest.id;

    if (bettingSettings.autoOpenDelayMs <= 0) return;
    if (autoOpenTimer.current) clock.clearTimeout(autoOpenTimer.current);
    autoOpenTimer.current = clock.setTimeout(() => {
      openBets();
    }, bettingSettings.autoOpenDelayMs);
  }, [bettingSettings.autoOpenDelayMs, clock, composed.platform.rounds, openBets]);

  useEffect(() => {
    if (!round || round.status !== "open" || !round.closesAt) return;

    const closesAtMs = new Date(round.closesAt).getTime();
    const remaining = closesAtMs - clock.nowMs();
    if (remaining <= 0) {
      closeBets("timer");
      return;
    }

    betTimer.current = clock.setTimeout(() => closeBets("timer"), remaining);
    return () => {
      if (betTimer.current) clock.clearTimeout(betTimer.current);
    };
  }, [clock, closeBets, round?.closesAt, round?.id, round?.status]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const onDealerEntry = useCallback(() => {
    if (editing || !bettingSettings.autoCloseOnEntry) return;
    closeBetsIfOpen("auto");
  }, [bettingSettings.autoCloseOnEntry, closeBetsIfOpen, editing]);

  const countdownSec =
    round?.status === "open" && round.closesAt
      ? Math.max(0, Math.ceil((new Date(round.closesAt).getTime() - clock.nowMs()) / 1000))
      : null;

  return {
    round,
    closedRound,
    openBets,
    closeBets: () => closeBets("dealer"),
    onDealerEntry,
    countdownSec,
    clearTimers,
  };
}
