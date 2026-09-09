import {
  getBankroll,
  getRoundSettlements,
  type AnimationTrigger,
  type ComposedState,
  type TableEvent,
} from "@casino-lord/core";

export function derivePlatformAnimations(
  prev: ComposedState<unknown>,
  next: ComposedState<unknown>,
  event: TableEvent,
): AnimationTrigger[] {
  const triggers: AnimationTrigger[] = [];
  const settings = next.platform.settings;

  switch (event.type) {
    case "BETS_OPENED":
      triggers.push({ eventId: "bets_open", vars: {} });
      break;
    case "BETS_CLOSED":
      triggers.push({ eventId: "bets_closed", vars: {} });
      break;
    case "SESSION_ENDED":
      triggers.push({ eventId: "session_end", vars: {} });
      triggers.push({ eventId: "leaderboard", vars: {} });
      break;
    case "SERIES_ENDED":
      triggers.push({ eventId: "leaderboard", vars: {} });
      break;
    case "RESULT_RECORDED": {
      const roundId = event.result.roundId;
      if (!roundId) break;
      const settlements = getRoundSettlements(next.platform, roundId);
      const threshold = settings.bank.bigWinMultiple * settings.bank.tableMin;
      for (const s of settlements) {
        if (s.profit >= threshold) {
          triggers.push({ eventId: "big_win", vars: { profit: s.profit } });
          break;
        }
      }
      for (const player of next.platform.players) {
        const before = getBankroll(prev.platform, player.id);
        const after = getBankroll(next.platform, player.id);
        if (before > 0 && after === 0) {
          triggers.push({ eventId: "player_bust", vars: { player: player.name } });
        }
      }
      break;
    }
  }

  return triggers;
}
