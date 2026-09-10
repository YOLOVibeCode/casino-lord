import type { BetsView, BettingRound } from "@casino-lord/core";
import "./betting-strip.css";

export interface BettingStripProps {
  round: BettingRound | null;
  betsView: BetsView;
  countdownSec: number | null;
  settlementTicker: string;
  betTimerSec?: number;
}

function roundTimerTotalSec(round: BettingRound, betTimerSec: number): number | null {
  if (round.closesAt && round.openedAt) {
    const total = (Date.parse(round.closesAt) - Date.parse(round.openedAt)) / 1000;
    if (total > 0) return total;
  }
  if (betTimerSec > 0) return betTimerSec;
  return null;
}

export function BettingStrip({
  round,
  betsView,
  countdownSec,
  settlementTicker,
  betTimerSec = 0,
}: BettingStripProps) {
  const statusLabel =
    round?.status === "open"
      ? "BETS OPEN"
      : round?.status === "closed"
        ? "NO MORE BETS"
        : round?.status === "settled" && settlementTicker
          ? settlementTicker
          : "BETS — idle";

  const totalSec = round?.status === "open" ? roundTimerTotalSec(round, betTimerSec) : null;
  const timerPct =
    round?.status === "open" && countdownSec !== null && totalSec !== null
      ? Math.min(100, Math.max(0, (countdownSec / totalSec) * 100))
      : round?.status === "open"
        ? 100
        : 0;

  return (
    <div class="betting-strip" data-testid="betting-strip">
      <div class="betting-strip__main">
        <span class="betting-strip__status">{statusLabel}</span>
        {round?.status === "open" && countdownSec !== null && (
          <div class="betting-strip__bar" aria-hidden="true">
            <div class="betting-strip__bar-fill" style={{ width: `${timerPct}%` }} />
          </div>
        )}
      </div>
      {round?.status !== "settled" &&
        betsView.summaries.map((row) => (
          <span key={row.label} class="betting-strip__side">
            {row.label} {row.amount.toLocaleString()} ({row.count})
          </span>
        ))}
    </div>
  );
}
