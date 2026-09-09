import type { BetsView, LayoutPreset, TableMeta } from "@casino-lord/core";
import { theoreticalDistribution } from "../engine.js";
import type { CrapsRules } from "../rules.js";
import type { CrapsState, Point, RollRecord } from "../types.js";
import { DicePair } from "./DiceFace.js";
import { rollBadge } from "./dice-display.js";
import "./craps-tokens.css";
import "./display-view.css";

const POINTS: Point[] = [4, 5, 6, 8, 9, 10];

export interface DisplayViewProps {
  state: CrapsState;
  rules: CrapsRules;
  table: TableMeta;
  bets: BetsView;
  layout: LayoutPreset;
}

function distributionCounts(state: CrapsState, rules: CrapsRules): number[] {
  if (rules.distributionWindow === "shooter") {
    const dist = Array.from({ length: 13 }, () => 0);
    for (const roll of state.shooter.rolls) {
      dist[roll.total] = (dist[roll.total] ?? 0) + 1;
    }
    return dist;
  }
  return state.table.distribution;
}

function pointsMadeOnBox(state: CrapsState, box: Point): boolean {
  return state.shooter.distinctPointsMade.includes(box);
}

function PuckBoard({ state, compact }: { state: CrapsState; compact?: boolean }) {
  const puckOn = state.phase === "point" && state.point !== null;
  return (
    <div class={`craps-puck-board${compact ? " craps-puck-board--compact" : ""}`}>
      {POINTS.map((box) => {
        const isPoint = state.point === box;
        const made = pointsMadeOnBox(state, box);
        return (
          <div
            key={box}
            class={`craps-puck-board__box${isPoint ? " craps-puck-board__box--active" : ""}`}
            data-testid={`point-box-${box}`}
          >
            <span class="craps-puck-board__num">{box}</span>
            {puckOn && isPoint && (
              <span class="craps-puck-board__puck" data-testid="puck">
                ON
              </span>
            )}
            {made && <span class="craps-puck-board__made">✔</span>}
          </div>
        );
      })}
      {!puckOn && (
        <span class="craps-puck-board__off" data-testid="puck">
          OFF
        </span>
      )}
    </div>
  );
}

function HistoryStrip({ rolls }: { rolls: RollRecord[] }) {
  return (
    <div class="craps-history" data-testid="roll-history">
      {rolls.map((roll) => {
        const badge = rollBadge(roll.info);
        return (
          <span key={roll.id} class="craps-history__item" data-testid={`history-roll-${roll.id}`}>
            <DicePair a={roll.a} b={roll.b} />
            <span class="craps-history__total">{roll.total}</span>
            {badge && <span class="craps-history__badge">{badge}</span>}
          </span>
        );
      })}
    </div>
  );
}

function DistributionPanel({ counts }: { counts: number[] }) {
  const theoretical = theoreticalDistribution();
  const max = Math.max(...counts.slice(2, 13), 1);
  return (
    <div class="craps-distribution" data-testid="distribution">
      {Array.from({ length: 11 }, (_, i) => i + 2).map((total) => {
        const count = counts[total] ?? 0;
        const height = (count / max) * 100;
        const refHeight = (theoretical[total] ?? 0) * max * 100;
        return (
          <div key={total} class="craps-distribution__bar-wrap">
            <div class="craps-distribution__ref" style={{ height: `${refHeight}%` }} />
            <div class="craps-distribution__bar" style={{ height: `${height}%` }} />
            <span class="craps-distribution__label">{total}</span>
          </div>
        );
      })}
    </div>
  );
}

function HardwaysPanel({ state }: { state: CrapsState }) {
  const hw = state.shooter.hardWays;
  return (
    <div class="craps-hardways" data-testid="hardways-panel">
      HARD WAYS 4:{hw["4"]} 6:{hw["6"]} 8:{hw["8"]} 10:{hw["10"]}
    </div>
  );
}

function FireProgress({ state, rules }: { state: CrapsState; rules: CrapsRules }) {
  if (!rules.trackFire) return null;
  const filled = state.shooter.distinctPointsMade.length;
  return (
    <div class="craps-fire" data-testid="fire-progress">
      FIRE{" "}
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} class={i < filled ? "craps-fire__dot--on" : "craps-fire__dot"}>
          ●
        </span>
      ))}
    </div>
  );
}

function AtsProgress({ state, rules }: { state: CrapsState; rules: CrapsRules }) {
  if (!rules.trackAllTallSmall) return null;
  return (
    <div class="craps-ats" data-testid="ats-progress">
      SMALL: {state.shooter.ats.small.join(",") || "—"} · TALL:{" "}
      {state.shooter.ats.tall.join(",") || "—"}
    </div>
  );
}

function HeaderStats({
  state,
  table,
  rules,
}: {
  state: CrapsState;
  table: TableMeta;
  rules: CrapsRules;
}) {
  const shooterLabel = state.seriesLabel ?? `Shooter ${table.seriesNumber}`;
  const pointText =
    state.phase === "point" && state.point !== null ? ` · Point ON ${state.point}` : "";
  return (
    <header class="craps-display__header">
      <span>
        {shooterLabel} · Roll {state.shooter.rollCount}
        {pointText}
      </span>
      <span>
        POINTS MADE {state.shooter.pointsMade}
        <FireProgress state={state} rules={rules} />
      </span>
    </header>
  );
}

export function DisplayView({ state, rules, table, layout }: DisplayViewProps) {
  const layoutId = layout.id;
  const counts = distributionCounts(state, rules);
  const showHistory = layoutId !== "puck-focus";
  const showDistribution = layoutId === "classic" || layoutId === "history-focus";
  const compactPuck = layoutId === "history-focus";

  return (
    <div
      class={`craps-display display-view display-view--${layoutId}`}
      data-testid="display-view"
      data-layout={layoutId}
    >
      <HeaderStats state={state} table={table} rules={rules} />
      <PuckBoard state={state} compact={compactPuck} />

      {rules.showLiveDice && (state.liveInput.a !== null || state.liveInput.b !== null) && (
        <div class="craps-display__live" data-testid="last-roll-dice">
          <DicePair a={state.liveInput.a} b={state.liveInput.b} />
        </div>
      )}

      {state.lastRoll && (
        <div class="craps-display__last-roll">
          LAST: {state.lastRoll.total}
          {state.lastRoll.hard === true ? " HARD" : ""}
        </div>
      )}

      <div class="craps-display__body">
        {showHistory && <HistoryStrip rolls={state.shooter.rolls} />}
        {showDistribution && <DistributionPanel counts={counts} />}
      </div>

      <div class="craps-display__footer">
        <HardwaysPanel state={state} />
        <AtsProgress state={state} rules={rules} />
        <span data-testid="table-stats">
          TABLE: {state.table.rolls} rolls · {state.table.shooters} shooters
        </span>
      </div>
    </div>
  );
}
