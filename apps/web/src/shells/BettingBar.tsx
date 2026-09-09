import type { BetsView, BettingRound } from "@casino-lord/core";
import "./betting-bar.css";

export interface BettingBarProps {
  round: BettingRound | null;
  betsView: BetsView;
  countdownSec: number | null;
  onToggle: () => void;
}

export function BettingBar({ round, betsView, countdownSec, onToggle }: BettingBarProps) {
  const statusLabel =
    round?.status === "open"
      ? "BETS OPEN"
      : round?.status === "closed"
        ? "NO MORE BETS"
        : "BETS — idle";

  return (
    <button type="button" class="betting-bar" data-testid="betting-bar" onClick={onToggle}>
      <span class="betting-bar__status">{statusLabel}</span>
      {countdownSec !== null && (
        <span class="betting-bar__countdown" data-testid="betting-countdown">
          · 0:{String(countdownSec).padStart(2, "0")}
        </span>
      )}
      {betsView.summaries.map((row) => (
        <span key={row.label} class="betting-bar__side">
          {row.label} {row.amount.toLocaleString()} ({row.count})
        </span>
      ))}
    </button>
  );
}
