import { PlayingCard } from "@casino-lord/ui";
import type { BaccaratState } from "../state.js";
import type { BaccaratResult, Card, SlotId } from "../types.js";
import { BANKER_SLOTS, PLAYER_SLOTS, formatSlotCard, outcomeDisplayLabel } from "./card-display.js";
import "./current-hand-panel.css";

interface CurrentHandPanelProps {
  state: BaccaratState;
}

function renderCards(slots: Partial<Record<SlotId, Card>>, sideSlots: SlotId[]) {
  return sideSlots
    .map((slot) => ({ slot, card: slots[slot] }))
    .filter((row): row is { slot: SlotId; card: Card } => Boolean(row.card))
    .map(({ slot, card }, i) => (
      <span
        key={`${slot}-${card.rank}`}
        class={`current-hand-panel__card${i === 2 ? " current-hand-panel__card--third" : ""}`}
        aria-label={formatSlotCard(card)}
      >
        <PlayingCard rank={card.rank} suit={card.suit} size="lg" />
      </span>
    ));
}

function lastResult(state: BaccaratState): BaccaratResult | null {
  const last = state.results[state.results.length - 1];
  return last?.data ?? null;
}

export function CurrentHandPanel({ state }: CurrentHandPanelProps) {
  const { liveSlots, handState } = state;
  const hasLive = Object.keys(liveSlots).length > 0;
  const result = !hasLive ? lastResult(state) : null;

  const displaySlots = hasLive ? liveSlots : (result?.cards ?? {});
  const playerTotal = hasLive ? handState.playerTotal : result?.playerTotal;
  const bankerTotal = hasLive ? handState.bankerTotal : result?.bankerTotal;
  const hint = hasLive ? handState.hint : null;

  return (
    <div class="current-hand-panel" data-testid="current-hand-panel">
      <div class="current-hand-panel__row">
        <span class="current-hand-panel__side current-hand-panel__side--P">P:</span>
        <div class="current-hand-panel__cards">
          {hasLive || result?.cards
            ? renderCards(displaySlots, PLAYER_SLOTS)
            : result && !result.cards
              ? null
              : null}
        </div>
        {playerTotal !== null && (
          <span class="current-hand-panel__total" data-testid="display-player-total">
            = {playerTotal}
          </span>
        )}
      </div>
      <div class="current-hand-panel__row">
        <span class="current-hand-panel__side current-hand-panel__side--B">B:</span>
        <div class="current-hand-panel__cards">
          {hasLive || result?.cards ? renderCards(displaySlots, BANKER_SLOTS) : null}
        </div>
        {bankerTotal !== null && (
          <span class="current-hand-panel__total" data-testid="display-banker-total">
            = {bankerTotal}
          </span>
        )}
      </div>
      {hint && <div class="current-hand-panel__hint">{hint}</div>}
      {!hasLive && result && (
        <div
          class={`current-hand-panel__banner current-hand-panel__banner--${result.outcome}`}
          data-testid="result-banner"
        >
          ▶ {outcomeDisplayLabel(result.outcome)} WINS
        </div>
      )}
      {!hasLive && result && !result.cards && (
        <div class="current-hand-panel__hint">Quick entry — no cards</div>
      )}
    </div>
  );
}
