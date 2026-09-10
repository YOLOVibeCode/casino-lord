import { createElement } from "preact";
import type { ComponentType } from "preact";
import type { ComposedState, ResultEnvelope, TableEvent } from "@casino-lord/core";
import type { UntypedGameModule } from "../table/module-types.js";
import type { VirtualPendingState } from "../table/sync-store-types.js";
import { getVirtualRevealState, revealProgressLabel } from "./virtual-reveal-progress.js";

export interface VirtualPanelProps {
  virtualPending: VirtualPendingState | null;
  optimisticDealing: boolean;
  events: readonly TableEvent[];
  currentSeriesResults: readonly ResultEnvelope<unknown>[];
  module: UntypedGameModule;
  rules: unknown;
  composed: ComposedState<unknown>;
  game: string;
  triggerLabel: string;
}

export function VirtualPanel({
  virtualPending,
  optimisticDealing,
  events,
  currentSeriesResults,
  module,
  rules,
  composed,
  game,
  triggerLabel,
}: VirtualPanelProps) {
  const revealState = getVirtualRevealState(
    virtualPending,
    events,
    module.virtual?.kind,
    optimisticDealing,
  );
  if (revealState) {
    const progress = revealProgressLabel(revealState.count, revealState.kind);
    return (
      <div class="dealer-shell__module dealer-shell__virtual-panel">
        <div class="dealer-shell__virtual-reveal" data-testid="virtual-reveal">
          {progress}
        </div>
      </div>
    );
  }

  const last = currentSeriesResults.at(-1);
  if (last) {
    const headline =
      module.describeResult?.(last.data, rules) ?? `${module.resultLabel} ${last.index}`;
    return (
      <div class="dealer-shell__module dealer-shell__virtual-panel">
        <div class="dealer-shell__virtual-last-result" data-testid="virtual-last-result">
          <h2 class="dealer-shell__virtual-headline">{headline}</h2>
          {createElement(
            module.ResultDetailView as unknown as ComponentType<{
              result: unknown;
              rules: unknown;
              roll?: unknown;
            }>,
            {
              result: last.data,
              rules,
              ...(game === "craps"
                ? {
                    roll: (
                      composed.module as {
                        results?: { id: string }[];
                      }
                    ).results?.find((r) => r.id === last.id),
                  }
                : {}),
            },
          )}
        </div>
      </div>
    );
  }

  return (
    <div class="dealer-shell__module dealer-shell__virtual-panel">
      <p class="dealer-shell__virtual-empty" data-testid="virtual-empty">
        No {module.resultLabel.toLowerCase()}s yet — tap {triggerLabel}
      </p>
    </div>
  );
}
