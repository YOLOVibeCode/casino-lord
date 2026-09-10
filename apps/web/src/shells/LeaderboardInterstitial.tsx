import type { LeaderboardEntry } from "@casino-lord/core";
import "./leaderboard-interstitial.css";

export interface LeaderboardInterstitialProps {
  byBankroll: LeaderboardEntry[];
  byNet: LeaderboardEntry[];
  onDismiss: () => void;
  persistent?: boolean;
}

export function LeaderboardInterstitial({
  byBankroll,
  byNet,
  onDismiss,
  persistent = false,
}: LeaderboardInterstitialProps) {
  return (
    <div
      class="leaderboard-interstitial"
      data-testid="leaderboard-interstitial"
      onClick={persistent ? undefined : onDismiss}
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
        <p class="leaderboard-interstitial__disclaimer">Play chips — no cash value</p>
        {persistent && (
          <p
            class="leaderboard-interstitial__caption"
            data-testid="leaderboard-session-ended-caption"
          >
            Session ended — thanks for playing
          </p>
        )}
      </div>
    </div>
  );
}
