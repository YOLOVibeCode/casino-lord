import type { BetsView, LayoutPreset, TableMeta } from "@casino-lord/core";
import type { RouletteRules } from "../rules.js";
import type { RouletteState } from "../state.js";
import type { Pocket } from "../types.js";
import { pocketKey } from "../wheel.js";
import { formatPocket, pocketColorClass } from "./colors.js";
import { WheelGraphic } from "./WheelGraphic.js";
import "./roulette-tokens.css";
import "./display-view.css";

export interface DisplayViewProps {
  state: RouletteState;
  rules: RouletteRules;
  table: TableMeta;
  bets: BetsView;
  layout: LayoutPreset;
}

function historySlice(state: RouletteState, rules: RouletteRules) {
  return [...state.history].slice(-rules.historyLength).reverse();
}

function renderHistoryChip(pocket: Pocket | null, rules: RouletteRules, key: string) {
  if (pocket === null) {
    return (
      <div key={key} class="display-view__chip display-view__chip--void" data-testid="history-void">
        —
      </div>
    );
  }
  const color = pocketColorClass(pocket, rules);
  return (
    <div
      key={key}
      class={`display-view__chip display-view__chip--${color}`}
      data-testid={`history-chip-${formatPocket(pocket)}`}
    >
      {formatPocket(pocket)}
    </div>
  );
}

function HotColdPanel({
  title,
  pockets,
  counts,
}: {
  title: string;
  pockets: Pocket[];
  counts: Record<string, number>;
}) {
  return (
    <div class="display-view__hotcold-panel">
      <div class="display-view__hotcold-title">{title}</div>
      {pockets.map((p) => (
        <div
          key={String(p)}
          class="display-view__hotcold-row"
          data-testid={`${title.toLowerCase()}-${pocketKey(p)}`}
        >
          <span>{formatPocket(p)}</span>
          <span>×{counts[pocketKey(p)] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

export function DisplayView({ state, rules, layout }: DisplayViewProps) {
  const layoutId = layout.id;
  const history = historySlice(state, rules);
  const counted = state.history.filter((r) => r.pocket !== null).length;
  const lastLabel =
    state.lastSpin?.pocket !== null && state.lastSpin?.pocket !== undefined
      ? `${formatPocket(state.lastSpin.pocket)} ${(state.lastSpin.info?.color ?? pocketColorClass(state.lastSpin.pocket, rules)).toUpperCase()}`
      : "—";

  return (
    <div
      class={`roulette-display display-view display-view--${layoutId}`}
      data-testid="display-view"
      data-layout={layoutId}
    >
      <header class="display-view__header">
        Spins {counted} · Last {lastLabel}
      </header>

      <div class="display-view__body">
        <aside class="display-view__history-col" data-testid="display-history">
          <div class="display-view__section-label">LAST</div>
          {history.map((spin, i) => renderHistoryChip(spin.pocket, rules, `${spin.pocket}-${i}`))}
        </aside>

        <section class="display-view__wheel-col">
          <WheelGraphic
            rules={rules}
            lastSpin={state.lastSpin}
            counts={state.counts}
            sectorHeat={rules.sectorHeat && layoutId === "wheel-focus"}
          />
        </section>

        <aside class="display-view__stats-col">
          <div class="display-view__hotcold">
            <HotColdPanel title="HOT" pockets={state.hot} counts={state.counts} />
            <HotColdPanel title="COLD" pockets={state.cold} counts={state.counts} />
          </div>

          <div class="display-view__percentages" data-testid="display-percentages">
            <div>
              RED {state.percentages.red}% · BLACK {state.percentages.black}% · GREEN{" "}
              {state.percentages.green}%
            </div>
            <div>
              ODD {state.percentages.odd}% · EVEN {state.percentages.even}%
            </div>
            <div>
              LOW {state.percentages.low}% · HIGH {state.percentages.high}%
            </div>
            <div>
              1st 12 {state.percentages.dozen[0]}% · 2nd 12 {state.percentages.dozen[1]}% · 3rd 12{" "}
              {state.percentages.dozen[2]}%
            </div>
            <div>
              COL 1 {state.percentages.column[0]}% · COL 2 {state.percentages.column[1]}% · COL 3{" "}
              {state.percentages.column[2]}%
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
