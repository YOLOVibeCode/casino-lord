import type { ActionDef, GameModule, Series } from "@casino-lord/core";
import { isActionEnabled } from "./actions-enabled.js";
import { blackjackAnimationEvents, deriveBlackjackAnimations } from "./animations.js";
import { blackjackBets } from "./bets.js";
import type { BlackjackBetTarget } from "./bet-target.js";
import { blackjackConfirm } from "./confirm.js";
import { reduce } from "./reducer.js";
import type { BlackjackRules } from "./rules.js";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";
import {
  actionSchema,
  betTargetSchema,
  defaultRules,
  liveInputSchema,
  resultSchema,
  rulesSchema,
} from "./schemas.js";
import { exportRound, importText } from "./serialize.js";
import { settleBlackjack } from "./settle.js";
import { initialState, type BlackjackState } from "./state.js";
import { blackjackStats } from "./stats.js";
import type { BlackjackLiveInput, BlackjackResult } from "./types.js";
import { blackjackTurn } from "./turn.js";
import { blackjackVirtualStep, type BlackjackAction } from "./virtual.js";
import { DealerView } from "./views/DealerView.js";
import { DisplayView } from "./views/DisplayView.js";
import { PlayerView } from "./views/PlayerView.js";
import { ResultDetailView } from "./views/ResultDetailView.js";
import { RulesSettingsView } from "./views/RulesSettingsView.js";

const playerActions: ActionDef<BlackjackAction>[] = [
  {
    id: "hit",
    label: "Hit",
    action: "hit",
    enabled: (state, me) =>
      isActionEnabled("hit", state as BlackjackState, me, DEFAULT_BLACKJACK_RULES),
  },
  {
    id: "stand",
    label: "Stand",
    action: "stand",
    enabled: (state, me) =>
      isActionEnabled("stand", state as BlackjackState, me, DEFAULT_BLACKJACK_RULES),
  },
  {
    id: "double",
    label: "Double",
    action: "double",
    enabled: (state, me) =>
      isActionEnabled("double", state as BlackjackState, me, DEFAULT_BLACKJACK_RULES),
  },
  {
    id: "split",
    label: "Split",
    action: "split",
    enabled: (state, me) =>
      isActionEnabled("split", state as BlackjackState, me, DEFAULT_BLACKJACK_RULES),
  },
  {
    id: "surrender",
    label: "Surrender",
    action: "surrender",
    enabled: (state, me) =>
      isActionEnabled("surrender", state as BlackjackState, me, DEFAULT_BLACKJACK_RULES),
  },
];

export type { BlackjackAction };

export const blackjackModule: GameModule<
  BlackjackRules,
  BlackjackResult,
  BlackjackLiveInput,
  BlackjackState,
  BlackjackBetTarget,
  BlackjackAction
> = {
  id: "blackjack",
  name: "Blackjack",
  seriesLabel: "Shoe",
  resultLabel: "Round",

  defaultRules,
  rulesSchema,
  resultSchema,
  liveInputSchema,
  betTargetSchema,
  actionSchema,

  initialState,
  reduce,
  confirm: blackjackConfirm,

  DealerView: DealerView as unknown as GameModule<
    BlackjackRules,
    BlackjackResult,
    BlackjackLiveInput,
    BlackjackState
  >["DealerView"],
  DisplayView: DisplayView as unknown as GameModule<
    BlackjackRules,
    BlackjackResult,
    BlackjackLiveInput,
    BlackjackState
  >["DisplayView"],
  PlayerView: PlayerView as unknown as GameModule<
    BlackjackRules,
    BlackjackResult,
    BlackjackLiveInput,
    BlackjackState,
    BlackjackBetTarget,
    BlackjackAction
  >["PlayerView"],
  ResultDetailView: ResultDetailView as unknown as GameModule<
    BlackjackRules,
    BlackjackResult,
    BlackjackLiveInput,
    BlackjackState
  >["ResultDetailView"],
  RulesSettingsView: RulesSettingsView as unknown as GameModule<
    BlackjackRules,
    BlackjackResult,
    BlackjackLiveInput,
    BlackjackState
  >["RulesSettingsView"],

  bets: blackjackBets,

  settle(input) {
    return settleBlackjack(input);
  },

  playerActions,
  turn(state) {
    return blackjackTurn(state, DEFAULT_BLACKJACK_RULES);
  },
  seats: { max: DEFAULT_BLACKJACK_RULES.seats, assign: "player" },

  virtual: {
    kind: "shoe",
    shoe: {
      decks: (rules) => rules.decks,
      penetration: (rules) => rules.penetration,
    },
    step(input) {
      const out = blackjackVirtualStep(input);
      let session = input.session;
      for (const event of out.events) {
        if (event.type === "LIVE_INPUT") {
          session = (event as unknown as { payload: { virtual?: unknown } }).payload.virtual;
        }
      }
      return { ...out, session };
    },
  },

  animationEvents: blackjackAnimationEvents,

  deriveAnimations(prev, next, event) {
    return deriveBlackjackAnimations(prev, next, event);
  },

  stats: blackjackStats,

  layouts: [
    { id: "classic", label: "Classic", aspect: "16:9" },
    { id: "dealer-focus", label: "Dealer Focus", aspect: "16:9" },
    { id: "stats-focus", label: "Stats Focus", aspect: "16:9" },
    { id: "portrait", label: "Portrait", aspect: "9:16" },
  ],

  exportSeries(series: Series<BlackjackResult>, _rules: BlackjackRules): string {
    return series.results.map((r) => exportRound(r.data)).join("\n");
  },

  importSeries(text: string, rules: BlackjackRules = DEFAULT_BLACKJACK_RULES) {
    const result = importText(text, rules);
    if (!result.ok) {
      return { error: result.errors.join("; ") };
    }
    return {
      results: result.rounds.map((r) => r.result),
      warnings: result.warnings,
    };
  },
};
