import type { BetsView, LayoutPreset, TableMeta } from "@casino-lord/core";
import { resolveRoundSeats } from "../engine.js";
import type { BlackjackRules } from "../rules.js";
import { blackjackStats } from "../stats.js";
import type { BlackjackState } from "../state.js";
import type { HandInput, Seat, SeatOutcome } from "../types.js";
import {
  dealerStatusLabel,
  formatCardGlyph,
  handTotalLabel,
  isRedSuit,
  outcomeColor,
  outcomeDisplayLabel,
} from "./card-display.js";
import "./blackjack-tokens.css";
import "./display-view.css";

export interface DisplayViewProps {
  state: BlackjackState;
  rules: BlackjackRules;
  table: TableMeta;
  bets: BetsView;
  layout: LayoutPreset;
}

function renderCard(card: { rank: string; suit: string | null }, faceDown = false) {
  if (faceDown) {
    return <span class="display-view__card display-view__card--down">▮▮</span>;
  }
  const red = card.suit ? isRedSuit(card.suit as import("../types.js").Suit) : false;
  return (
    <span class={`display-view__card${red ? " display-view__card--red" : ""}`}>
      {formatCardGlyph(card as import("../types.js").Card)}
    </span>
  );
}

function resolvedHands(
  seat: Seat,
  hands: HandInput[] | undefined,
  state: BlackjackState,
  rules: BlackjackRules,
): HandInput[] {
  if (!hands?.length) return [];
  if (rules.entryDepth === "full") {
    const resolved = resolveRoundSeats(state.liveInput.seats, state.liveInput.dealer, rules);
    return resolved[seat] ?? hands;
  }
  return hands;
}

function SeatPanel({
  seat,
  hands,
  rules,
  entryDepth,
}: {
  seat: Seat;
  hands: HandInput[];
  rules: BlackjackRules;
  entryDepth: BlackjackRules["entryDepth"];
}) {
  const active = hands.length > 0;
  return (
    <div
      class={`display-view__seat${active ? "" : " display-view__seat--empty"}`}
      data-testid={`seat-${seat}`}
      data-seat={String(seat)}
    >
      <div class="display-view__seat-label">SEAT {seat}</div>
      {!active && <span>—</span>}
      {hands.map((hand, hi) => {
        const { label } = handTotalLabel(hand, rules);
        const outcome = hand.outcome;
        return (
          <div class="display-view__hand" key={hi} data-testid={`seat-${seat}-hand-${hi}`}>
            {entryDepth === "full" && hand.cards.length > 0 && (
              <div>
                {hand.cards.map((c, ci) => (
                  <span key={ci}>{renderCard(c)} </span>
                ))}
              </div>
            )}
            {entryDepth === "full" && hand.cards.length > 0 && (
              <div class="display-view__hand-total">{label}</div>
            )}
            {hand.doubled && <span class="display-view__hand-tag">×2</span>}
            {outcome && (
              <div
                class="display-view__outcome"
                style={{ color: outcomeColor(outcome) }}
                data-testid={`seat-${seat}-outcome-${hi}`}
              >
                {outcomeDisplayLabel(outcome as SeatOutcome)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DisplayView({ state, rules, layout }: DisplayViewProps) {
  const layoutId = layout.id;
  const { liveInput, roundEvaluation } = state;
  const validation = roundEvaluation.dealerValidation;
  const stats = blackjackStats(state, rules);
  const showLargeStats = layoutId === "stats-focus";

  const dealerCards = liveInput.dealer;
  const holeHidden = dealerCards.length === 1;

  return (
    <div
      class={`blackjack-display display-view display-view--${layoutId}`}
      data-testid="display-view"
      data-layout={layoutId}
    >
      <div class="display-view__dealer" data-testid="dealer-hand">
        <div class="display-view__dealer-label">DEALER</div>
        <div class="display-view__dealer-cards">
          {dealerCards.length === 0 && "—"}
          {dealerCards.map((c, i) => (
            <span key={i}>{renderCard(c, holeHidden && i === 1)} </span>
          ))}
        </div>
        <div class="display-view__dealer-status">
          {dealerStatusLabel(validation.dealerStatus, validation.total, validation.soft)}
        </div>
      </div>

      <div class="display-view__seats">
        {Array.from({ length: rules.seats }, (_, i) => {
          const seat = (i + 1) as Seat;
          const hands = resolvedHands(seat, liveInput.seats[seat], state, rules);
          return (
            <SeatPanel
              key={seat}
              seat={seat}
              hands={hands}
              rules={rules}
              entryDepth={rules.entryDepth}
            />
          );
        })}
      </div>

      <div class="display-view__footer">
        <div class="display-view__shoe">
          <div>
            SHOE {state.penetrationPct}%{state.penetrationEstimated ? " (est.)" : ""}
          </div>
          <div class="display-view__shoe-bar">
            <div
              class="display-view__shoe-fill"
              style={{ width: `${Math.min(100, state.penetrationPct)}%` }}
            />
          </div>
          <div>
            Cards {state.cardsSeen} / {state.cardsTotal}
          </div>
        </div>
        <div class="display-view__stats">
          {(showLargeStats ? stats : stats.slice(0, 6)).map((row) => (
            <span class="display-view__stat" key={row.label}>
              {row.label}: {row.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
