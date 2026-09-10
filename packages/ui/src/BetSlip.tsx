import { useState } from "preact/hooks";
import "./bet-slip.css";

export interface BetSlipEntry {
  id: string;
  label: string;
  amount: number;
  pending: boolean;
  detail?: string;
}

export interface BetSlipProps {
  entries: BetSlipEntry[];
  total: number;
  pendingStake?: number;
  locked: boolean;
  canPlace: boolean;
  placeLabel?: string;
  disabledReason?: string;
  error?: string;
  onRemove: (id: string, pending: boolean) => void;
  onPlace: () => void;
}

function compactSummary(entries: BetSlipEntry[]): string {
  if (entries.length === 0) return "";
  return entries.map((e) => e.label).join(" · ");
}

export function BetSlip({
  entries,
  total,
  pendingStake = 0,
  locked,
  canPlace,
  placeLabel,
  disabledReason,
  error,
  onRemove,
  onPlace,
}: BetSlipProps) {
  const [expanded, setExpanded] = useState(false);
  const hasEntries = entries.length > 0;
  const compact = hasEntries && !expanded;
  const hasPending = entries.some((e) => e.pending);
  const placeDisabled = !canPlace || !hasPending;
  const placeText = placeLabel ?? `✓ PLACE ${pendingStake > 0 ? pendingStake : ""}`;

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
          <span class="bet-slip__compact-total" data-testid="bet-slip-compact-total">
            Stake {total}
          </span>
        </button>
      )}

      <div class="bet-slip__details">
        <div class="bet-slip__title">Bet slip</div>
        {entries.map((entry) => (
          <div key={entry.id} class="bet-slip__row" data-testid={`bet-slip-row-${entry.id}`}>
            <span class="bet-slip__label">
              {entry.detail ?? entry.label}
              {entry.pending && !entry.detail ? " (pending)" : ""}
            </span>
            {!entry.detail && <span class="bet-slip__amount">{entry.amount}</span>}
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
        <>
          <button
            type="button"
            class="bet-slip__place"
            data-testid="bet-slip-place"
            disabled={placeDisabled}
            title={placeDisabled && disabledReason ? disabledReason : undefined}
            aria-describedby={placeDisabled && disabledReason ? "bet-slip-place-reason" : undefined}
            onClick={onPlace}
          >
            {placeText}
          </button>
          {placeDisabled && disabledReason && (
            <p
              id="bet-slip-place-reason"
              class="bet-slip__error"
              data-testid="bet-slip-place-reason"
            >
              {disabledReason}
            </p>
          )}
        </>
      )}
      {error && (
        <p class="bet-slip__error" data-testid="bet-slip-error">
          {error}
        </p>
      )}
    </div>
  );
}
