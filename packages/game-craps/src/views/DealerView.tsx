import { DicePicker, OutcomeChips } from "@casino-lord/ui";
import type { DieFace } from "@casino-lord/ui";
import type { Emit, TableMeta } from "@casino-lord/core";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { classifyRoll, normalizeResult } from "../engine.js";
import type { CrapsRules } from "../rules.js";
import type { CrapsResult, CrapsState, Face } from "../types.js";
import { DicePair } from "./DiceFace.js";
import { puckLabel, rollBadge, ruleHintLine } from "./dice-display.js";
import "./craps-tokens.css";
import "./dealer-view.css";

const POINTS = [4, 5, 6, 8, 9, 10] as const;

const TOTAL_CHIPS = Array.from({ length: 11 }, (_, i) => i + 2).flatMap((total) => {
  const chips: { id: string; label: string; color: string; ariaLabel: string }[] = [
    {
      id: `t${total}`,
      label: String(total),
      color: "#334155",
      ariaLabel: `Quick entry total ${total}`,
    },
  ];
  if (total === 4 || total === 6 || total === 8 || total === 10) {
    chips.push({
      id: `t${total}H`,
      label: `${total}H`,
      color: "#8e5bd9",
      ariaLabel: `Quick entry hard ${total}`,
    });
  }
  return chips;
});

export interface DealerViewPlayer {
  id: string;
  name: string;
}

export interface DealerViewProps {
  state: CrapsState;
  rules: CrapsRules;
  table: TableMeta;
  emit: Emit;
  record: (result: CrapsResult, opts: { quick: boolean }) => void;
  players?: readonly DealerViewPlayer[];
  autoAdvance?: boolean;
  expressMode?: boolean;
  haptics?: boolean;
}

export function DealerView({
  state,
  rules,
  table,
  emit,
  record,
  players = [],
  expressMode = true,
  haptics = false,
}: DealerViewProps) {
  const { liveInput, phase, point, shooter } = state;
  const [totalMode, setTotalMode] = useState(false);

  const emitLive = useCallback(
    (a: Face | null, b: Face | null) => {
      emit({
        type: "LIVE_INPUT",
        payload: { a, b },
        source: "dealer",
      } as Parameters<Emit>[0]);
    },
    [emit],
  );

  const handleDieA = useCallback(
    (face: DieFace) => {
      emitLive(face, liveInput.b);
    },
    [emitLive, liveInput.b],
  );

  const handleDieB = useCallback(
    (face: DieFace) => {
      emitLive(liveInput.a, face);
    },
    [emitLive, liveInput.a],
  );

  const handleClear = useCallback(() => {
    emitLive(null, null);
  }, [emitLive]);

  const handleCommit = useCallback(() => {
    if (liveInput.a === null || liveInput.b === null) return;
    try {
      const result = normalizeResult({ a: liveInput.a, b: liveInput.b });
      record(result, { quick: false });
      emitLive(null, null);
    } catch {
      // invalid
    }
  }, [emitLive, liveInput.a, liveInput.b, record]);

  const previewInfo = useMemo(() => {
    if (liveInput.a === null && liveInput.b === null) return null;
    try {
      const result = normalizeResult({ a: liveInput.a, b: liveInput.b });
      return classifyRoll(result, phase, point);
    } catch {
      return null;
    }
  }, [liveInput.a, liveInput.b, phase, point]);

  const handleTotalChip = useCallback(
    (id: string) => {
      const hardMatch = /^t(\d+)H$/.exec(id);
      if (hardMatch) {
        const total = Number(hardMatch[1]);
        record(normalizeResult({ a: null, b: null, total, hard: true }), { quick: true });
        return;
      }
      const totalMatch = /^t(\d+)$/.exec(id);
      if (totalMatch) {
        const total = Number(totalMatch[1]);
        record(normalizeResult({ a: null, b: null, total, hard: null }), { quick: true });
      }
    },
    [record],
  );

  const handleSevenOut = useCallback(() => {
    record(normalizeResult({ a: null, b: null, total: 7, hard: null }), { quick: true });
  }, [record]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        setTotalMode((v) => !v);
      }
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSevenOut();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSevenOut]);

  const puckOn = phase === "point" && point !== null;
  const shooterLabel = state.seriesLabel ?? `Shooter ${table.seriesNumber}`;
  const shooterName =
    (state.currentShooterId !== null
      ? players.find((p) => p.id === state.currentShooterId)?.name
      : undefined) ?? "—";

  return (
    <div class="craps-display dealer-view" data-testid="dealer-view">
      <header class="dealer-view__header">
        <div class="dealer-view__header-main">
          <span class="dealer-view__puck" data-testid="dealer-puck">
            {puckLabel(puckOn, point)}
          </span>
          <span class="dealer-view__shooter-name" data-testid="dealer-shooter-name">
            Shooter: {shooterName}
          </span>
        </div>
        <span class="dealer-view__shooter">
          {shooterLabel} · Roll {shooter.rollCount + 1}
        </span>
      </header>

      <div class="dealer-view__preview">
        <DicePair
          a={liveInput.a ?? state.lastRoll?.a ?? null}
          b={liveInput.b ?? state.lastRoll?.b ?? null}
          testId="dealer-last-dice"
        />
        <p class="dealer-view__hint" data-testid="rule-hint">
          {ruleHintLine(previewInfo, phase, point)}
        </p>
      </div>

      <div class="dealer-view__history" data-testid="dealer-history">
        History:{" "}
        {shooter.rolls.length === 0
          ? "—"
          : shooter.rolls.map((roll) => {
              const badge = rollBadge(roll.info);
              return (
                <span key={roll.id} class="dealer-view__history-item">
                  {roll.total}
                  {badge ? ` ${badge}` : ""}
                </span>
              );
            })}
      </div>

      {!totalMode ? (
        <DicePicker
          dieA={liveInput.a}
          dieB={liveInput.b}
          expressMode={expressMode}
          haptics={haptics}
          onDieA={handleDieA}
          onDieB={handleDieB}
          onCommit={handleCommit}
          onClear={handleClear}
        />
      ) : (
        <div class="dealer-view__total-mode" data-testid="total-mode">
          <OutcomeChips chips={TOTAL_CHIPS} onTap={handleTotalChip} onLongPress={handleTotalChip} />
        </div>
      )}

      <div class="dealer-view__quick-row">
        <button
          type="button"
          class="dealer-view__mode-toggle"
          data-testid="total-mode-toggle"
          title={
            totalMode
              ? "Switch to Die A and Die B faces"
              : "Switch to totals 2–12 (Hard/Easy when ambiguous)"
          }
          onClick={() => setTotalMode((v) => !v)}
        >
          {totalMode ? "Face mode" : "Total mode"}
        </button>
        <button
          type="button"
          class="dealer-view__seven-out"
          data-testid="seven-out-chip"
          title="Record a 7 with unknown faces — next shooter"
          onClick={handleSevenOut}
        >
          Seven Out
        </button>
      </div>
    </div>
  );
}
