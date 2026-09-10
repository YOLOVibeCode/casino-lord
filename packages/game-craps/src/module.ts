import type { GameModule, Series } from "@casino-lord/core";
import { actionSchema, crapsPlayerActions, type CrapsAction } from "./actions.js";
import { deriveCrapsAnimations, crapsAnimationEvents } from "./animations.js";
import { crapsBets } from "./bets.js";
import type { CrapsBetTarget } from "./bet-target.js";
import { crapsConfirm } from "./confirm.js";
import { reduce } from "./reducer.js";
import { DEFAULT_CRAPS_RULES, type CrapsRules } from "./rules.js";
import {
  betTargetSchema,
  defaultRules,
  liveInputSchema,
  resultSchema,
  rulesSchema,
} from "./schemas.js";
import { exportRoll, importText } from "./serialize.js";
import { settleCraps } from "./settle.js";
import { initialState } from "./state.js";
import type { CrapsState } from "./types.js";
import { crapsStats } from "./stats.js";
import type { CrapsLiveInput, CrapsResult } from "./types.js";
import { describeCrapsResult } from "./describe-result.js";
import { crapsVirtualStep } from "./virtual.js";
import { DealerView } from "./views/DealerView.js";
import { DisplayView } from "./views/DisplayView.js";
import { ResultDetailView } from "./views/ResultDetailView.js";
import { PlayerView } from "./views/PlayerView.js";
import { RulesSettingsView } from "./views/RulesSettingsView.js";

export const crapsModule: GameModule<
  CrapsRules,
  CrapsResult,
  CrapsLiveInput,
  CrapsState,
  CrapsBetTarget,
  CrapsAction
> = {
  id: "craps",
  name: "Craps",
  seriesLabel: "Shooter",
  resultLabel: "Roll",

  defaultRules: DEFAULT_CRAPS_RULES,
  rulesSchema,
  resultSchema,
  liveInputSchema,
  betTargetSchema,
  actionSchema,

  initialState,
  reduce,
  confirm: crapsConfirm,

  DealerView: DealerView as unknown as GameModule<
    CrapsRules,
    CrapsResult,
    CrapsLiveInput,
    CrapsState,
    CrapsBetTarget,
    CrapsAction
  >["DealerView"],
  DisplayView: DisplayView as unknown as GameModule<
    CrapsRules,
    CrapsResult,
    CrapsLiveInput,
    CrapsState,
    CrapsBetTarget,
    CrapsAction
  >["DisplayView"],
  PlayerView: PlayerView as unknown as GameModule<
    CrapsRules,
    CrapsResult,
    CrapsLiveInput,
    CrapsState,
    CrapsBetTarget,
    CrapsAction
  >["PlayerView"],
  ResultDetailView: ResultDetailView as unknown as GameModule<
    CrapsRules,
    CrapsResult,
    CrapsLiveInput,
    CrapsState,
    CrapsBetTarget,
    CrapsAction
  >["ResultDetailView"],
  RulesSettingsView: RulesSettingsView as unknown as GameModule<
    CrapsRules,
    CrapsResult,
    CrapsLiveInput,
    CrapsState,
    CrapsBetTarget,
    CrapsAction
  >["RulesSettingsView"],

  bets: crapsBets,

  settle(input) {
    return settleCraps(input);
  },

  playerActions: crapsPlayerActions,

  turn(state) {
    if (!state.currentShooterId) return null;
    return {
      playerId: state.currentShooterId,
      prompt: "YOU HAVE THE DICE — shake or tap ROLL",
    };
  },

  virtual: {
    kind: "dice",
    step: crapsVirtualStep,
  },

  animationEvents: crapsAnimationEvents,

  deriveAnimations(prev, next, event) {
    return deriveCrapsAnimations(prev, next, event);
  },

  stats: crapsStats,

  layouts: [
    { id: "classic", label: "Classic", aspect: "16:9" },
    { id: "puck-focus", label: "Puck Focus", aspect: "16:9" },
    { id: "history-focus", label: "History Focus", aspect: "16:9" },
    { id: "portrait", label: "Portrait", aspect: "9:16" },
  ],

  exportSeries(series: Series<CrapsResult>, _rules: CrapsRules): string {
    return series.results.map((r) => exportRoll(r.data)).join(" ");
  },

  importSeries(text: string, rules: CrapsRules = DEFAULT_CRAPS_RULES) {
    const result = importText(text, rules);
    if (!result.ok) {
      return { error: result.errors.join("; ") };
    }
    return { results: result.results, warnings: result.warnings };
  },

  describeResult(result, _rules) {
    return describeCrapsResult(result);
  },
};
