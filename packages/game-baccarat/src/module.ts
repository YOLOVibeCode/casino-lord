import type { Component } from "preact";
import type { GameModule, Series } from "@casino-lord/core";
import { deriveBaccaratAnimations, baccaratAnimationEvents } from "./animations.js";
import { baccaratBets } from "./bets.js";
import type { BaccaratBetId } from "./bet-target.js";
import { reduce } from "./reducer.js";
import type { BaccaratRules } from "./rules.js";
import { DEFAULT_BACCARAT_RULES } from "./rules.js";
import {
  betTargetSchema,
  defaultRules,
  liveInputSchema,
  resultSchema,
  rulesSchema,
} from "./schemas.js";
import { settleBaccarat } from "./settle.js";
import { initialState, type BaccaratState } from "./state.js";
import { baccaratStats } from "./stats.js";
import type { BaccaratLiveInput, BaccaratResult } from "./types.js";
import { exportHand, importText, type ImportedHand } from "./serialize.js";
import { baccaratConfirm } from "./confirm.js";
import { formatOutcomeToken } from "./quick-entry.js";

function stubComponent(): Component<Record<string, unknown>> {
  return (() => null) as unknown as Component<Record<string, unknown>>;
}

function resultToImportedHand(result: BaccaratResult): ImportedHand {
  return {
    result,
    roadHand: {
      outcome: result.outcome,
      playerPair: result.playerPair,
      bankerPair: result.bankerPair,
    },
    line: 0,
    raw: formatOutcomeToken({
      outcome: result.outcome,
      playerPair: result.playerPair,
      bankerPair: result.bankerPair,
    }),
  };
}

export const baccaratModule: GameModule<
  BaccaratRules,
  BaccaratResult,
  BaccaratLiveInput,
  BaccaratState,
  BaccaratBetId
> = {
  id: "baccarat",
  name: "Baccarat",
  seriesLabel: "Shoe",
  resultLabel: "Hand",

  defaultRules,
  rulesSchema,
  resultSchema,
  liveInputSchema,
  betTargetSchema,

  initialState,
  reduce,
  confirm: baccaratConfirm,

  DealerView: stubComponent() as GameModule<
    BaccaratRules,
    BaccaratResult,
    BaccaratLiveInput,
    BaccaratState
  >["DealerView"],
  DisplayView: stubComponent() as GameModule<
    BaccaratRules,
    BaccaratResult,
    BaccaratLiveInput,
    BaccaratState
  >["DisplayView"],
  PlayerView: stubComponent() as GameModule<
    BaccaratRules,
    BaccaratResult,
    BaccaratLiveInput,
    BaccaratState
  >["PlayerView"],
  ResultDetailView: stubComponent() as GameModule<
    BaccaratRules,
    BaccaratResult,
    BaccaratLiveInput,
    BaccaratState
  >["ResultDetailView"],
  RulesSettingsView: stubComponent() as GameModule<
    BaccaratRules,
    BaccaratResult,
    BaccaratLiveInput,
    BaccaratState
  >["RulesSettingsView"],

  bets: baccaratBets,

  settle(input) {
    return settleBaccarat(input);
  },

  animationEvents: baccaratAnimationEvents,

  deriveAnimations(prev, next, event) {
    return deriveBaccaratAnimations(prev, next, event);
  },

  stats: baccaratStats,

  layouts: [{ id: "classic", label: "Classic", aspect: "16:9" }],

  exportSeries(series: Series<BaccaratResult>, _rules: BaccaratRules): string {
    return series.results.map((r) => exportHand(resultToImportedHand(r.data))).join(" ");
  },

  importSeries(text: string, rules: BaccaratRules = DEFAULT_BACCARAT_RULES) {
    const result = importText(text, rules);
    if (!result.ok) {
      return { error: result.errors.join("; ") };
    }
    return {
      results: result.hands.map((h) => h.result),
      warnings: result.warnings,
    };
  },
};
