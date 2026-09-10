import type { BetsView, BettingRound } from "@casino-lord/core";
import "./betting-bar.css";

export interface BettingBarProps {
  round: BettingRound | null;
  betsView: BetsView;
  countdownSec: number | null;
  onToggle: () => void;
  onVoidBets?: () => void;
}

export function BettingBar({
  round,
  betsView,
  countdownSec,
  onToggle,
  onVoidBets,
}: BettingBarProps) {
  const isOpen = round?.status === "open";
  const isClosed = round?.status === "closed";

  const statusText = isOpen
    ? countdownSec !== null
      ? `Bets open · ${countdownSec} s`
      : "Bets open"
    : isClosed
      ? "Bets closed"
      : "No round yet";

  const toggleLabel = isOpen ? "CLOSE BETS" : "OPEN BETS";
  const toggleMod = isOpen
    ? "betting-bar__toggle--open"
    : isClosed
      ? "betting-bar__toggle--closed"
      : "betting-bar__toggle--idle";

  const showVoid = isOpen && betsView.openBets.length > 0 && onVoidBets;

  return (
    <div class="betting-bar" data-testid="betting-bar">
      <div class="betting-bar__row">
        <button
          type="button"
          class={`betting-bar__toggle ${toggleMod}`}
          data-testid="betting-toggle"
          onClick={onToggle}
        >
          {toggleLabel}
        </button>
        <span class="betting-bar__status" data-testid="betting-status">
          {statusText}
        </span>
        {isOpen && countdownSec !== null && (
          <span class="betting-bar__countdown" data-testid="betting-countdown">
            · 0:{String(countdownSec).padStart(2, "0")}
          </span>
        )}
        {showVoid && (
          <button
            type="button"
            class="betting-bar__void"
            data-testid="betting-void-btn"
            onClick={onVoidBets}
          >
            Void open bets
          </button>
        )}
      </div>
      {betsView.summaries.length > 0 && (
        <div class="betting-bar__zones">
          <span class="betting-bar__legend">Totals by betting zone</span>
          {betsView.summaries.map((row) => (
            <span key={row.label} class="betting-bar__side">
              {row.label}: {row.amount.toLocaleString()} chips · {row.count} bet
              {row.count === 1 ? "" : "s"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
