import type { CrapsRules } from "../rules.js";
import type { CrapsResult, RollRecord } from "../types.js";
import { DicePair } from "./DiceFace.js";
import { classificationSummary, decisionLabel, formatFacePair } from "./dice-display.js";
import "./craps-tokens.css";
import "./result-detail-view.css";

export interface ResultDetailViewProps {
  result: CrapsResult;
  rules: CrapsRules;
  roll?: RollRecord;
}

export function ResultDetailView({ result, roll }: ResultDetailViewProps) {
  const info = roll?.info;
  const classification = info ? classificationSummary(info) : `Total ${result.total}`;

  return (
    <div class="craps-display result-detail" data-testid="result-detail">
      <div class="result-detail__total" data-testid="result-total">
        {result.total}
        {result.hard === true ? " HARD" : ""}
      </div>

      <div class="result-detail__dice">
        <DicePair a={result.a} b={result.b} testId="result-dice" />
        <span>{formatFacePair(result.a, result.b)}</span>
      </div>

      <div class="result-detail__classification" data-testid="result-classification">
        {classification}
      </div>

      {info && (
        <div class="result-detail__puck" data-testid="result-puck-states">
          <span>Puck before: {info.pointBefore !== null ? `ON ${info.pointBefore}` : "OFF"}</span>
          <span>Puck after: {info.pointAfter !== null ? `ON ${info.pointAfter}` : "OFF"}</span>
          <span>Phase: {info.phase}</span>
          <span>Decision: {decisionLabel(info.decision)}</span>
        </div>
      )}

      {result.a === null && result.b === null && (
        <p class="result-detail__quick-note" data-testid="quick-entry-note">
          Quick entry — faces unknown
        </p>
      )}
    </div>
  );
}
