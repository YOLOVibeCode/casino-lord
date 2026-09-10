import { NumberGrid, type NumberGridPocket } from "@casino-lord/ui";
import type { Emit, TableMeta } from "@casino-lord/core";
import { useCallback, useEffect } from "preact/hooks";
import { classifyPocket } from "../wheel.js";
import type { RouletteRules } from "../rules.js";
import type { RouletteState } from "../state.js";
import type { Pocket, RouletteResult } from "../types.js";
import { formatPocket, pocketColorClass } from "./colors.js";
import "./dealer-view.css";

function toGridPocket(pocket: Pocket | null): NumberGridPocket | null {
  if (pocket === null) return null;
  if (pocket === "0") return 0;
  return pocket;
}

function fromGridPocket(pocket: NumberGridPocket): Pocket {
  return pocket;
}

const NO_SPIN_CHIP = {
  id: "no-spin",
  label: "—",
  color: "#6b7280",
  ariaLabel: "No spin",
};

export interface DealerViewProps {
  state: RouletteState;
  rules: RouletteRules;
  table: TableMeta;
  emit: Emit;
  record: (result: RouletteResult, opts: { quick: boolean }) => void;
  haptics?: boolean;
}

function hintLine(state: RouletteState, rules: RouletteRules): string {
  if (state.livePending !== null) {
    const info = classifyPocket(state.livePending, rules);
    const parts = [
      `${formatPocket(state.livePending)} ${info.color.toUpperCase()}`,
      info.parity?.toUpperCase(),
      info.range === "low" ? "LOW" : info.range === "high" ? "HIGH" : null,
      info.dozen
        ? `${info.dozen}${info.dozen === 1 ? "st" : info.dozen === 2 ? "nd" : "rd"} dozen`
        : null,
      info.column
        ? `${info.column}${info.column === 1 ? "st" : info.column === 2 ? "nd" : "rd"} column`
        : null,
    ].filter(Boolean);
    if (rules.wheel === "french" && rules.zeroRule !== "none" && state.livePending === 0) {
      parts.push(rules.zeroRule === "la_partage" ? "La partage applies" : "En prison applies");
    }
    return parts.join(" · ");
  }
  if (state.lastSpin?.pocket === null) return "No spin recorded";
  if (state.lastSpin) {
    const p = state.lastSpin.pocket;
    if (p === null) return "No spin recorded";
    const info = state.lastSpin.info ?? classifyPocket(p, rules);
    return `${formatPocket(p)} ${info.color.toUpperCase()}`;
  }
  return "Enter winning number";
}

function recentSpins(state: RouletteState, limit = 6): typeof state.history {
  return [...state.history].slice(-limit).reverse();
}

export function DealerView({ state, rules, emit, record, haptics = false }: DealerViewProps) {
  const emitPending = useCallback(
    (pocket: Pocket | null) => {
      emit({
        type: "LIVE_INPUT",
        payload: { pending: pocket },
        source: "dealer",
      } as Parameters<Emit>[0]);
    },
    [emit],
  );

  const handleSelect = useCallback(
    (pocket: NumberGridPocket | null) => {
      if (pocket === null) {
        emitPending(null);
        return;
      }
      const resolved = fromGridPocket(pocket);
      if (rules.autoConfirm) {
        record({ pocket: resolved }, { quick: false });
        emitPending(null);
        return;
      }
      emitPending(resolved);
    },
    [emitPending, record, rules.autoConfirm],
  );

  const handleNoSpin = useCallback(() => {
    record({ pocket: null }, { quick: true });
    emitPending(null);
  }, [emitPending, record]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        handleNoSpin();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleNoSpin]);

  return (
    <div class="dealer-view" data-testid="dealer-view">
      <p class="dealer-view__hint" aria-live="polite" data-testid="dealer-hint">
        {hintLine(state, rules)}
      </p>

      <div class="dealer-view__felt">
        <NumberGrid
          wheel={rules.wheel}
          selected={toGridPocket(state.livePending)}
          onSelect={handleSelect}
          requireConfirm={false}
          haptics={haptics}
        />
      </div>

      <div class="dealer-view__footer">
        <div class="dealer-view__quick">
          <button
            type="button"
            class="dealer-view__no-spin"
            style={{ background: NO_SPIN_CHIP.color }}
            aria-label={NO_SPIN_CHIP.ariaLabel}
            data-testid="outcome-chip-no-spin"
            onClick={handleNoSpin}
          >
            {NO_SPIN_CHIP.label}
          </button>
        </div>

        <div class="dealer-view__history" data-testid="dealer-history-strip">
          <span class="dealer-view__history-label">Last:</span>
          {recentSpins(state).map((spin, i) => {
            if (spin.pocket === null) {
              return (
                <span key={`void-${i}`} class="dealer-view__chip dealer-view__chip--void">
                  —
                </span>
              );
            }
            const color = pocketColorClass(spin.pocket, rules);
            return (
              <span
                key={`${String(spin.pocket)}-${i}`}
                class={`dealer-view__chip dealer-view__chip--${color}`}
              >
                {formatPocket(spin.pocket)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
