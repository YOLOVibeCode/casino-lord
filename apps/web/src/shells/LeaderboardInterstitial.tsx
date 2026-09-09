import type { LeaderboardEntry } from "@casino-lord/core";
import "./leaderboard-interstitial.css";

export interface LeaderboardInterstitialProps {
  byBankroll: LeaderboardEntry[];
  byNet: LeaderboardEntry[];
  onDismiss: () => void;
}

export function LeaderboardInterstitial({
  byBankroll,
  byNet,
  onDismiss,
}: LeaderboardInterstitialProps) {
  return (
    <div
      class="leaderboard-interstitial"
      data-testid="leaderboard-interstitial"
      onClick={onDismiss}
    >
      <div class="leaderboard-interstitial__panel" onClick={(e) => e.stopPropagation()}>
        <h2>Leaderboard</h2>
        <div class="leaderboard-interstitial__columns">
          <section>
            <h3>By bankroll</h3>
            <ol>
              {byBankroll.map((e) => (
                <li key={e.playerId}>
                  {e.name} — {e.bankroll.toLocaleString()}
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h3>By net</h3>
            <ol>
              {byNet.map((e) => (
                <li key={e.playerId}>
                  {e.name} — {e.net >= 0 ? "+" : ""}
                  {e.net.toLocaleString()}
                </li>
              ))}
            </ol>
          </section>
        </div>
        <button type="button" onClick={onDismiss}>
          Continue
        </button>
      </div>
    </div>
  );
}
