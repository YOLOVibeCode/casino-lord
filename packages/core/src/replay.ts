import type { GameModule } from "./game-module.js";
import type { TableEvent } from "./events.js";
import { isPersistedEvent, isResultMutationEvent } from "./events.js";
import type { PlatformState } from "./platform-state.js";
import { initialPlatformState } from "./platform-state.js";
import { reducePlatform, type PlatformReducerContext } from "./platform-reducer.js";
import { stableStringify } from "./platform-state.js";
import { resolveEffectiveRules } from "./merge-settings.js";

export interface ComposedState<State> {
  module: State;
  platform: PlatformState;
}

export interface ReplayOptions {
  code?: string;
  /** When true, apply ephemeral events (e.g. LIVE_INPUT) in the log. Default false for persisted replay. */
  includeEphemeral?: boolean;
}

export function applyEvent<Rules, Result, LiveInput, State, BetTarget, Action>(
  composed: ComposedState<State>,
  event: TableEvent,
  module: GameModule<Rules, Result, LiveInput, State, BetTarget, Action>,
  fallbackRules: Rules,
): ComposedState<State> {
  const effectiveRulesBefore = resolveEffectiveRules(
    fallbackRules,
    composed.platform.settings.rules,
  );
  const moduleBefore = composed.module;

  if (event.type === "SETTINGS_CHANGED") {
    const ctxBefore: PlatformReducerContext<Rules, Result, LiveInput, State, BetTarget, Action> = {
      module,
      rules: effectiveRulesBefore,
      moduleBefore,
      moduleAfter: moduleBefore,
    };
    const platformAfter = reducePlatform(composed.platform, event, ctxBefore);
    const effectiveRulesAfter = resolveEffectiveRules(fallbackRules, platformAfter.settings.rules);
    const moduleAfter = module.reduce(moduleBefore, event, effectiveRulesAfter);
    return { module: moduleAfter, platform: platformAfter };
  }

  const moduleAfter = module.reduce(moduleBefore, event, effectiveRulesBefore);
  const ctx: PlatformReducerContext<Rules, Result, LiveInput, State, BetTarget, Action> = {
    module,
    rules: effectiveRulesBefore,
    moduleBefore,
    moduleAfter,
  };
  const platformAfter = reducePlatform(composed.platform, event, ctx);
  return { module: moduleAfter, platform: platformAfter };
}

function eventsForReplay(events: TableEvent[], includeEphemeral: boolean): TableEvent[] {
  return includeEphemeral ? events : events.filter(isPersistedEvent);
}

export function replay<Rules, Result, LiveInput, State, BetTarget = unknown, Action = never>(
  events: TableEvent[],
  module: GameModule<Rules, Result, LiveInput, State, BetTarget, Action>,
  rules: Rules,
  options: ReplayOptions = {},
): ComposedState<State> {
  const includeEphemeral = options.includeEphemeral ?? false;
  const persisted = eventsForReplay(events, includeEphemeral);

  for (let i = 0; i < persisted.length; i++) {
    const event = persisted[i]!;
    if (isResultMutationEvent(event)) {
      const prefix = persisted.slice(0, i + 1);
      const tail = persisted.slice(i + 1);
      let state = replayLinear(prefix, module, rules, options);
      for (const tailEvent of tail) {
        state = applyEvent(state, tailEvent, module, rules);
      }
      return state;
    }
  }

  return replayLinear(persisted, module, rules, options);
}

function replayLinear<Rules, Result, LiveInput, State, BetTarget, Action>(
  events: TableEvent[],
  module: GameModule<Rules, Result, LiveInput, State, BetTarget, Action>,
  rules: Rules,
  options: ReplayOptions,
): ComposedState<State> {
  let composed: ComposedState<State> = {
    module: module.initialState(rules),
    platform: initialPlatformState(),
  };

  for (const event of events) {
    if (event.type === "TABLE_CREATED" && options.code !== undefined) {
      composed = applyEvent(composed, event, module, rules);
      composed = {
        ...composed,
        platform: { ...composed.platform, code: options.code },
      };
      continue;
    }
    composed = applyEvent(composed, event, module, rules);
  }

  return composed;
}

export { stableStringify };

export function assertReplayDeterministic<Rules, Result, LiveInput, State, BetTarget, Action>(
  events: TableEvent[],
  module: GameModule<Rules, Result, LiveInput, State, BetTarget, Action>,
  rules: Rules,
  options: ReplayOptions = {},
): void {
  const first = stableStringify(replay(events, module, rules, options));
  const second = stableStringify(replay(events, module, rules, options));
  if (first !== second) {
    throw new Error("Replay is not deterministic");
  }
}
