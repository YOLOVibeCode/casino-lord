import type { Component } from "preact";
import type { GameModule, Series } from "@casino-lord/core";
import { deriveRouletteAnimations, rouletteAnimationEvents } from "./animations.js";
import { rouletteBets } from "./bets.js";
import { rouletteConfirm } from "./confirm.js";
import { reduce } from "./reducer.js";
import { DEFAULT_ROULETTE_RULES, type RouletteRules } from "./rules.js";
import {
  betTargetSchema,
  defaultRules,
  liveInputSchema,
  resultSchema,
  rulesSchema,
} from "./schemas.js";
import { exportBody, importBody } from "./serialize.js";
import { settleRoulette } from "./settle.js";
import { initialState, type RouletteState } from "./state.js";
import { rouletteStats } from "./stats.js";
import type { RouletteBetTarget } from "./bet-target.js";
import type { RouletteLiveInput, RouletteResult } from "./types.js";
import { virtualWheelStep } from "./virtual.js";
import { DealerView } from "./views/DealerView.js";
import { DisplayView } from "./views/DisplayView.js";
import { ResultDetailView } from "./views/ResultDetailView.js";
import { RulesSettingsView } from "./views/RulesSettingsView.js";

function stubComponent(): Component<Record<string, unknown>> {
  return (() => null) as unknown as Component<Record<string, unknown>>;
}

export const rouletteModule: GameModule<
  RouletteRules,
  RouletteResult,
  RouletteLiveInput,
  RouletteState,
  RouletteBetTarget
> = {
  id: "roulette",
  name: "Roulette",
  seriesLabel: "Session",
  resultLabel: "Spin",

  defaultRules,
  rulesSchema,
  resultSchema,
  liveInputSchema,
  betTargetSchema,

  initialState,
  reduce,
  confirm: rouletteConfirm,

  DealerView: DealerView as unknown as GameModule<
    RouletteRules,
    RouletteResult,
    RouletteLiveInput,
    RouletteState
  >["DealerView"],
  DisplayView: DisplayView as unknown as GameModule<
    RouletteRules,
    RouletteResult,
    RouletteLiveInput,
    RouletteState
  >["DisplayView"],
  PlayerView: stubComponent() as GameModule<
    RouletteRules,
    RouletteResult,
    RouletteLiveInput,
    RouletteState
  >["PlayerView"],
  ResultDetailView: ResultDetailView as unknown as GameModule<
    RouletteRules,
    RouletteResult,
    RouletteLiveInput,
    RouletteState
  >["ResultDetailView"],
  RulesSettingsView: RulesSettingsView as unknown as GameModule<
    RouletteRules,
    RouletteResult,
    RouletteLiveInput,
    RouletteState
  >["RulesSettingsView"],

  bets: rouletteBets,

  settle(input) {
    return settleRoulette(input);
  },

  virtual: {
    kind: "wheel",
    step({ state, rules, rng }) {
      return virtualWheelStep(state, rules, rng);
    },
  },

  animationEvents: rouletteAnimationEvents,

  deriveAnimations(prev, next, event) {
    return deriveRouletteAnimations(prev, next, event, DEFAULT_ROULETTE_RULES);
  },

  stats: rouletteStats,

  layouts: [
    { id: "classic", label: "Classic", aspect: "16:9" },
    { id: "results-focus", label: "Results Focus", aspect: "16:9" },
    { id: "wheel-focus", label: "Wheel Focus", aspect: "16:9" },
    { id: "portrait", label: "Portrait", aspect: "9:16" },
  ],

  exportSeries(series: Series<RouletteResult>, _rules: RouletteRules): string {
    return exportBody(series.results.map((r) => r.data));
  },

  importSeries(text: string, rules: RouletteRules = DEFAULT_ROULETTE_RULES) {
    const result = importBody(text, rules);
    if ("error" in result) return { error: result.error };
    return { results: result.results, warnings: result.warnings };
  },
};
