import type { BlackjackRules } from "../rules.js";
import type { BlackjackResult, HandInput, Seat } from "../types.js";
import { ALL_SEATS } from "../types.js";
import {
  formatCardList,
  handTotalLabel,
  outcomeColor,
  outcomeDisplayLabel,
} from "./card-display.js";
import "./blackjack-tokens.css";
import "./result-detail-view.css";

export interface ResultDetailViewProps {
  result: BlackjackResult;
  rules: BlackjackRules;
}

function renderHand(
  hand: HandInput,
  handIndex: number,
  rules: BlackjackRules,
  depth: BlackjackResult["depth"],
) {
  const { label } = handTotalLabel(hand, rules);
  const outcome = hand.outcome;
  return (
    <div class="result-detail__hand-row" data-testid={`result-hand-${handIndex}`}>
      {depth !== "quick" && depth !== "outcomes" && hand.cards.length > 0 && (
        <span data-testid={`result-hand-${handIndex}-cards`}>{formatCardList(hand.cards)}</span>
      )}
      {depth === "outcomes" && hand.cards.length === 0 && outcome && (
        <span>{outcomeDisplayLabel(outcome)}</span>
      )}
      {hand.cards.length > 0 && <span>{label}</span>}
      {outcome && (
        <span
          class="result-detail__outcome"
          style={{ color: outcomeColor(outcome) }}
          data-testid={`result-hand-${handIndex}-outcome`}
        >
          {outcomeDisplayLabel(outcome)}
        </span>
      )}
      {hand.doubled && <span class="result-detail__tag">×2</span>}
      {hand.surrendered && <span class="result-detail__tag">SURR</span>}
      {hand.fromSplit && <span class="result-detail__tag">split</span>}
    </div>
  );
}

export function ResultDetailView({ result, rules }: ResultDetailViewProps) {
  const activeSeats = ALL_SEATS.filter((s) => result.seats[s]?.length);

  return (
    <div class="blackjack-display result-detail" data-testid="result-detail">
      {result.dealerError && (
        <div class="result-detail__dealer-error" data-testid="result-dealer-error">
          DEALER ERROR — recorded despite illegal dealer play
        </div>
      )}

      <div class="result-detail__section">
        <div class="result-detail__section-title">Dealer</div>
        {result.depth === "quick" ? (
          <p class="result-detail__quick-note" data-testid="quick-entry-note">
            Quick entry — no cards
          </p>
        ) : (
          <div class="result-detail__hand-row">
            {result.dealer.cards.length > 0 && (
              <span data-testid="result-dealer-cards">{formatCardList(result.dealer.cards)}</span>
            )}
            {result.dealer.bust && (
              <span style={{ color: "#E08A1E" }}>BUST {result.dealer.total}</span>
            )}
            {result.dealer.blackjack && <span style={{ color: "#D7263D" }}>BLACKJACK</span>}
            {!result.dealer.bust && !result.dealer.blackjack && result.dealer.total !== null && (
              <span>= {result.dealer.total}</span>
            )}
          </div>
        )}
      </div>

      {activeSeats.map((seat: Seat) => {
        const hands = result.seats[seat] ?? [];
        return (
          <div class="result-detail__section" key={seat} data-testid={`result-seat-${seat}`}>
            <div class="result-detail__section-title">Seat {seat}</div>
            {hands.map((hand, i) => renderHand(hand, i, rules, result.depth))}
          </div>
        );
      })}
    </div>
  );
}
