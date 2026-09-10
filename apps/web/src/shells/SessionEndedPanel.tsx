import type { LeaderboardEntry } from "@casino-lord/core";

export interface SessionEndedPanelProps {
  resultCount: number;
  playerCount: number;
  chipsIssuedTotal: number;
  topBankrolls: LeaderboardEntry[];
  virtualTable: boolean;
  seedHex?: string;
  onCopyExport: () => void;
  onNewTable?: () => void;
  onHome: () => void;
}

export function SessionEndedPanel({
  resultCount,
  playerCount,
  chipsIssuedTotal,
  topBankrolls,
  virtualTable,
  seedHex,
  onCopyExport,
  onNewTable,
  onHome,
}: SessionEndedPanelProps) {
  return (
    <div class="dealer-shell__session-ended" data-testid="session-ended-panel">
      <h2>Session ended</h2>
      <dl class="dealer-shell__session-stats">
        <dt>Results this session</dt>
        <dd data-testid="session-ended-results">{resultCount.toLocaleString()}</dd>
        <dt>Players</dt>
        <dd data-testid="session-ended-players">{playerCount.toLocaleString()}</dd>
        <dt>Chips issued</dt>
        <dd data-testid="session-ended-chips">{chipsIssuedTotal.toLocaleString()}</dd>
      </dl>
      {topBankrolls.length > 0 && (
        <section class="dealer-shell__session-leaders">
          <h3>Final bankrolls</h3>
          <ol data-testid="session-ended-top-bankrolls">
            {topBankrolls.map((entry) => (
              <li key={entry.playerId}>
                {entry.name} — {entry.bankroll.toLocaleString()}
              </li>
            ))}
          </ol>
        </section>
      )}
      {virtualTable && (
        <p class="dealer-shell__session-seed" data-testid="session-ended-seed">
          {seedHex ? `Seed: ${seedHex}` : "Seed is revealed in the export"}
        </p>
      )}
      <div class="dealer-shell__session-actions">
        <button
          type="button"
          class="dealer-shell__btn dealer-shell__btn--confirm"
          data-testid="session-ended-copy-export"
          onClick={onCopyExport}
        >
          Copy export
        </button>
        {onNewTable ? (
          <button
            type="button"
            class="dealer-shell__btn"
            data-testid="session-ended-new-table"
            onClick={onNewTable}
          >
            New table
          </button>
        ) : (
          <button
            type="button"
            class="dealer-shell__btn"
            data-testid="session-ended-home"
            onClick={onHome}
          >
            Home
          </button>
        )}
      </div>
    </div>
  );
}
