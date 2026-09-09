import type { RouletteRules } from "../rules.js";
import type { RouletteResult } from "../types.js";
import { classifyPocket, wheelNeighbours } from "../wheel.js";
import { formatPocket, pocketColorClass } from "./colors.js";
import "./roulette-tokens.css";
import "./result-detail-view.css";

export interface ResultDetailViewProps {
  result: RouletteResult;
  rules: RouletteRules;
}

export function ResultDetailView({ result, rules }: ResultDetailViewProps) {
  if (result.pocket === null) {
    return (
      <div class="roulette-display result-detail" data-testid="result-detail">
        <div class="result-detail__outcome result-detail__outcome--void">NO SPIN</div>
        <p class="result-detail__note">Void spin — excluded from statistics</p>
      </div>
    );
  }

  const info = classifyPocket(result.pocket, rules);
  const neighbours = wheelNeighbours(result.pocket, rules);
  const color = pocketColorClass(result.pocket, rules);

  return (
    <div class="roulette-display result-detail" data-testid="result-detail">
      <div class={`result-detail__outcome result-detail__outcome--${color}`}>
        {formatPocket(result.pocket)} {info.color.toUpperCase()}
      </div>

      <dl class="result-detail__props">
        {info.parity && (
          <>
            <dt>Parity</dt>
            <dd data-testid="result-parity">{info.parity.toUpperCase()}</dd>
          </>
        )}
        {info.range && (
          <>
            <dt>Range</dt>
            <dd data-testid="result-range">
              {info.range === "low" ? "LOW (1–18)" : "HIGH (19–36)"}
            </dd>
          </>
        )}
        {info.dozen && (
          <>
            <dt>Dozen</dt>
            <dd data-testid="result-dozen">{info.dozen}</dd>
          </>
        )}
        {info.column && (
          <>
            <dt>Column</dt>
            <dd data-testid="result-column">{info.column}</dd>
          </>
        )}
        {info.sector && (
          <>
            <dt>Sector</dt>
            <dd data-testid="result-sector">{info.sector}</dd>
          </>
        )}
        <dt>Neighbours</dt>
        <dd data-testid="result-neighbours">{neighbours.map(formatPocket).join(" ")}</dd>
      </dl>
    </div>
  );
}
