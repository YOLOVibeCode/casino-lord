import type { BetsView, BettingRound } from "@casino-lord/core";
import "./betting-bar.css";

export interface BettingBarProps {
  round: BettingRound | null;
  betsView: BetsView;
  countdownSec: number | null;
  onToggle: () => void;
}

export function BettingBar({ round, betsView, countdownSec, onToggle }: BettingBarProps) {
  const isOpen = round?.status === "open";
  const isClosed = round?.status === "closed";

  const statusLabel = isOpen ? "BETS OPEN" : isClosed ? "NO MORE BETS" : "BETS — idle";

  const friendlyStatus = isOpen
    ? countdownSec !== null
      ? `Bets open · ${countdownSec} s`
      : "Bets open"
    : isClosed
      ? "Bets closed"
      : "No round yet";

  const toggleLabel = isOpen ? "CLOSE BETS" : "OPEN BETS";
  const toggleClass = isOpen
    ? "betting-bar__toggle betting-bar__toggle--open"
    : isClosed
      ? "betting-bar__toggle betting-bar__toggle--closed"
      : "betting-bar__toggle betting-bar__toggle--idle";

  return (
    <div class="betting-bar" data-testid="betting-bar">
      <button
        type="button"
        class={toggleClass}
        data-testid="betting-toggle-btn"
        onClick={onToggle}
      >
        {toggleLabel}
      </button>
      <div class="betting-bar__info">
        <span class="betting-bar__status">{statusLabel}</span>
        <span class="betting-bar__friendly">{friendlyStatus}</span>
        {countdownSec !== null && isOpen && (
          <span class="betting-bar__countdown" data-testid="betting-countdown">
            · 0:{String(countdownSec).padStart(2, "0")}
          </span>
        )}
      </div>
      {betsView.summaries.length > 0 && (
        <div class="betting-bar__zones">
          <span class="betting-bar__legend">Totals for current round</span>
          {betsView.summaries.map((row) => (
            <span key={row.label} class="betting-bar__side">
              {row.label} {row.amount.toLocaleString()} chips · {row.count}{" "}
              {row.count === 1 ? "bet" : "bets"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
