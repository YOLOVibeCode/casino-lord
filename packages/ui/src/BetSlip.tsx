import { useState } from "preact/hooks";
import "./bet-slip.css";

export interface BetSlipEntry {
  id: string;
  label: string;
  amount: number;
  pending: boolean;
}

export interface BetSlipProps {
  entries: BetSlipEntry[];
  total: number;
  locked: boolean;
  canPlace: boolean;
  error?: string;
  onRemove: (id: string, pending: boolean) => void;
  onPlace: () => void;
}

function compactSummary(entries: BetSlipEntry[]): string {
  if (entries.length === 0) return "Tap a zone to add bets";
  return entries.map((e) => `${e.label} ${e.amount}`).join(" · ");
}

export function BetSlip({
  entries,
  total,
  locked,
  canPlace,
  error,
  onRemove,
  onPlace,
}: BetSlipProps) {
  const [expanded, setExpanded] = useState(false);
  const hasEntries = entries.length > 0;
  const compact = hasEntries && !expanded;

  return (
    <div class={`bet-slip${compact ? " bet-slip--compact" : ""}`} data-testid="bet-slip">
      {hasEntries && (
        <button
          type="button"
          class="bet-slip__compact"
          data-testid="bet-slip-compact"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <span class="bet-slip__compact-label">{compactSummary(entries)}</span>
          <span class="bet-slip__compact-total">⛁ {total}</span>
        </button>
      )}

      <div class="bet-slip__details">
        <div class="bet-slip__title">Bet slip</div>
        {!hasEntries && !locked && (
          <p class="bet-slip__empty" data-testid="bet-slip-empty">
            Tap a zone to add bets
          </p>
        )}
        {entries.map((entry) => (
          <div key={entry.id} class="bet-slip__row" data-testid={`bet-slip-row-${entry.id}`}>
            <span class="bet-slip__label">
              {entry.label}
              {entry.pending ? " (pending)" : ""}
            </span>
            <span class="bet-slip__amount">{entry.amount}</span>
            <button
              type="button"
              class="bet-slip__remove"
              aria-label={`Remove ${entry.label}`}
              data-testid={`bet-slip-remove-${entry.id}`}
              onClick={() => onRemove(entry.id, entry.pending)}
            >
              ×
            </button>
          </div>
        ))}
        {hasEntries && (
          <div class="bet-slip__total" data-testid="bet-slip-total">
            <span>Total</span>
            <span>{total}</span>
          </div>
        )}
      </div>

      {locked ? (
        <p class="bet-slip__locked" data-testid="bet-slip-locked">
          Bets closed — good luck
        </p>
      ) : (
        <button
          type="button"
          class="bet-slip__place"
          data-testid="bet-slip-place"
          disabled={!canPlace || entries.filter((e) => e.pending).length === 0}
          onClick={onPlace}
        >
          ✓ PLACE {total > 0 ? total : ""}
        </button>
      )}
      {error && (
        <p class="bet-slip__error" data-testid="bet-slip-error">
          {error}
        </p>
      )}
    </div>
  );
}
