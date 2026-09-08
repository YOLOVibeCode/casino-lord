import type { GameModule } from "./game-module.js";
import type { Settlement } from "./betting.js";
import type { PlacedBet, ResultEnvelope } from "./data-model.js";
import type { TableEvent } from "./events.js";
import type { PlatformState } from "./platform-state.js";
import { initialPlatformState } from "./platform-state.js";

export interface PlatformReducerContext<Rules, Result, LiveInput, State, BetTarget, Action> {
  module: GameModule<Rules, Result, LiveInput, State, BetTarget, Action>;
  rules: Rules;
  moduleBefore: State;
  moduleAfter: State;
}

function roundDown(value: number): number {
  return Math.floor(value);
}

function applySettlementBankrolls(
  state: PlatformState,
  settlements: Settlement[],
  bets: PlacedBet[],
  reverse: boolean,
): PlatformState {
  const sign = reverse ? -1 : 1;
  const bankrolls = { ...state.bankrolls };
  const betById = new Map(bets.map((b) => [b.id, b]));

  for (const s of settlements) {
    const bet = betById.get(s.betId);
    if (!bet) continue;
    const playerId = bet.playerId;
    bankrolls[playerId] = (bankrolls[playerId] ?? 0) + sign * s.returned;
  }

  return { ...state, bankrolls };
}

function settleRound<Rules, Result, LiveInput, State, BetTarget, Action>(
  state: PlatformState,
  roundId: string,
  result: ResultEnvelope<Result>,
  ctx: PlatformReducerContext<Rules, Result, LiveInput, State, BetTarget, Action>,
): PlatformState {
  const roundBets = state.bets.filter((b) => b.roundId === roundId);
  const settlements = ctx.module.settle({
    bets: roundBets as PlacedBet<BetTarget>[],
    result: result.data,
    before: ctx.moduleBefore,
    after: ctx.moduleAfter,
    rules: ctx.rules,
  });

  const rounded = settlements.map((s) => ({
    ...s,
    profit: roundDown(s.profit),
    returned: roundDown(s.returned),
  }));

  let next = { ...state, settlements: { ...state.settlements, [roundId]: rounded } };

  if (state.participation.bank === "house") {
    next = applySettlementBankrolls(next, rounded, roundBets, false);
  }

  const rounds = state.rounds.map((r) =>
    r.id === roundId ? { ...r, status: "settled" as const, resultId: result.id } : r,
  );

  return { ...next, rounds };
}

export function reducePlatform<Rules, Result, LiveInput, State, BetTarget, Action>(
  state: PlatformState,
  event: TableEvent,
  ctx: PlatformReducerContext<Rules, Result, LiveInput, State, BetTarget, Action>,
): PlatformState {
  switch (event.type) {
    case "TABLE_CREATED":
      return {
        ...initialPlatformState(),
        code: "",
        game: event.game,
        participation: event.participation,
        settings: event.settings,
      };

    case "SETTINGS_CHANGED":
      return {
        ...state,
        settings: { ...state.settings, ...event.patch },
      };

    case "PARTICIPATION_CHANGED":
      return { ...state, participation: event.participation };

    case "SERIES_STARTED":
      return { ...state, currentSeriesId: event.seriesId };

    case "PLAYER_JOINED": {
      const players = [...state.players, event.player];
      const bankrolls = { ...state.bankrolls };
      if (!(event.player.id in bankrolls)) {
        bankrolls[event.player.id] = 0;
      }
      return { ...state, players, bankrolls };
    }

    case "PLAYER_UPDATED": {
      const players = state.players.map((p) =>
        p.id === event.playerId ? { ...p, ...event.patch } : p,
      );
      return { ...state, players };
    }

    case "PLAYER_REMOVED": {
      const players = state.players.map((p) =>
        p.id === event.playerId ? { ...p, status: "removed" as const } : p,
      );
      return { ...state, players };
    }

    case "BANK_ISSUED": {
      const bankrolls = { ...state.bankrolls };
      bankrolls[event.playerId] = (bankrolls[event.playerId] ?? 0) + event.amount;
      return { ...state, bankrolls };
    }

    case "BANK_ADJUSTED": {
      const bankrolls = { ...state.bankrolls };
      bankrolls[event.playerId] = (bankrolls[event.playerId] ?? 0) + event.delta;
      return { ...state, bankrolls };
    }

    case "BETS_OPENED": {
      const round = {
        id: event.roundId,
        status: "open" as const,
        openedAt: event.at,
        ...(event.closesAt !== undefined ? { closesAt: event.closesAt } : {}),
      };
      return { ...state, rounds: [...state.rounds, round] };
    }

    case "BET_PLACED": {
      const round = state.rounds.find((r) => r.id === event.bet.roundId);
      if (!round || round.status !== "open") {
        return state;
      }
      let next = { ...state, bets: [...state.bets, event.bet] };
      if (state.participation.bank === "house" && !event.bet.declared) {
        const bankrolls = { ...state.bankrolls };
        bankrolls[event.bet.playerId] = (bankrolls[event.bet.playerId] ?? 0) - event.bet.amount;
        next = { ...next, bankrolls };
      }
      return next;
    }

    case "BET_UPDATED": {
      const bet = state.bets.find((b) => b.id === event.betId);
      if (!bet) return state;
      const round = state.rounds.find((r) => r.id === bet.roundId);
      if (!round || round.status !== "open") return state;

      let bankrolls = state.bankrolls;
      if (
        state.participation.bank === "house" &&
        !bet.declared &&
        event.patch.amount !== undefined
      ) {
        const delta = event.patch.amount - bet.amount;
        bankrolls = { ...state.bankrolls };
        bankrolls[bet.playerId] = (bankrolls[bet.playerId] ?? 0) - delta;
      }

      const bets = state.bets.map((b) => (b.id === event.betId ? { ...b, ...event.patch } : b));
      return { ...state, bets, bankrolls };
    }

    case "BET_REMOVED": {
      const bet = state.bets.find((b) => b.id === event.betId);
      if (!bet) return state;
      let bankrolls = state.bankrolls;
      if (state.participation.bank === "house" && !bet.declared) {
        bankrolls = { ...state.bankrolls };
        bankrolls[bet.playerId] = (bankrolls[bet.playerId] ?? 0) + bet.amount;
      }
      return {
        ...state,
        bets: state.bets.filter((b) => b.id !== event.betId),
        bankrolls,
      };
    }

    case "BETS_CLOSED": {
      const rounds = state.rounds.map((r) =>
        r.id === event.roundId ? { ...r, status: "closed" as const, closedAt: event.at } : r,
      );
      return { ...state, rounds };
    }

    case "RESULT_RECORDED": {
      const roundId = event.result.roundId;
      if (!roundId) return state;
      const round = state.rounds.find((r) => r.id === roundId);
      if (!round || round.status === "settled") return state;

      const priorSettlements = state.settlements[roundId];
      let next = state;
      if (priorSettlements && state.participation.bank === "house") {
        const roundBets = state.bets.filter((b) => b.roundId === roundId);
        next = applySettlementBankrolls(next, priorSettlements, roundBets, true);
      }

      return settleRound(next, roundId, event.result as ResultEnvelope<Result>, ctx);
    }

    case "RESULT_EDITED":
    case "RESULT_DELETED": {
      const resultId = event.type === "RESULT_EDITED" ? event.result.id : event.resultId;
      const affectedRound = state.rounds.find((r) => r.resultId === resultId);
      if (!affectedRound) return state;

      const roundId = affectedRound.id;
      const priorSettlements = state.settlements[roundId];
      let next = state;
      if (priorSettlements && state.participation.bank === "house") {
        const roundBets = state.bets.filter((b) => b.roundId === roundId);
        next = applySettlementBankrolls(next, priorSettlements, roundBets, true);
      }

      const settlements = { ...next.settlements };
      delete settlements[roundId];
      const rounds = next.rounds.map((r) => {
        if (r.id !== roundId) return r;
        const { resultId: _removed, ...rest } = r;
        return { ...rest, status: "closed" as const };
      });
      next = { ...next, settlements, rounds };

      if (event.type === "RESULT_EDITED" && event.result.roundId) {
        return settleRound(next, event.result.roundId, event.result as ResultEnvelope<Result>, ctx);
      }
      return next;
    }

    case "LIVE_INPUT":
    case "ANIMATION_PREVIEW":
    case "SESSION_ENDED":
    case "DEALER_CHANGED":
    case "SERIES_ENDED":
    case "RESULT_UNDONE":
    case "TURN_ASSIGNED":
    case "PLAYER_ACTION":
      return state;

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
