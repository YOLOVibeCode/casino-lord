import type { BaccaratRules } from "../rules.js";
import type { BaccaratResult } from "../types.js";
import { BANKER_SLOTS, PLAYER_SLOTS, formatCardList, outcomeDisplayLabel } from "./card-display.js";
import "./baccarat-tokens.css";
import "./result-detail-view.css";

export interface ResultDetailViewProps {
  result: BaccaratResult;
  rules: BaccaratRules;
}

export function ResultDetailView({ result }: ResultDetailViewProps) {
  const badges: string[] = [];
  if (result.playerPair) badges.push("P PAIR");
  if (result.bankerPair) badges.push("B PAIR");
  if (result.natural) badges.push("NATURAL");

  return (
    <div class="baccarat-display result-detail" data-testid="result-detail">
      <div class={`result-detail__outcome result-detail__outcome--${result.outcome}`}>
        {outcomeDisplayLabel(result.outcome)} WINS
      </div>

      {result.cards === null ? (
        <p class="result-detail__quick-note" data-testid="quick-entry-note">
          Quick entry — no cards
        </p>
      ) : (
        <>
          <div class="result-detail__hand">
            <span>Player:</span>
            <span data-testid="result-player-cards">
              {formatCardList(result.cards, PLAYER_SLOTS) || "—"}
            </span>
            {result.playerTotal !== null && <span>= {result.playerTotal}</span>}
          </div>
          <div class="result-detail__hand">
            <span>Banker:</span>
            <span data-testid="result-banker-cards">
              {formatCardList(result.cards, BANKER_SLOTS) || "—"}
            </span>
            {result.bankerTotal !== null && <span>= {result.bankerTotal}</span>}
          </div>
        </>
      )}

      {badges.length > 0 && (
        <div class="result-detail__badges">
          {badges.map((b) => (
            <span key={b} class="result-detail__badge">
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
