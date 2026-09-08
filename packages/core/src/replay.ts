import type { GameModule } from "./game-module.js";
import type { TableEvent } from "./events.js";
import { isPersistedEvent, isResultMutationEvent } from "./events.js";
import type { PlatformState } from "./platform-state.js";
import { initialPlatformState } from "./platform-state.js";
import { reducePlatform, type PlatformReducerContext } from "./platform-reducer.js";
import { stableStringify } from "./platform-state.js";

export interface ComposedState<State> {
  module: State;
  platform: PlatformState;
}

export interface ReplayOptions {
  code?: string;
}

export function applyEvent<Rules, Result, LiveInput, State, BetTarget, Action>(
  composed: ComposedState<State>,
  event: TableEvent,
  module: GameModule<Rules, Result, LiveInput, State, BetTarget, Action>,
  rules: Rules,
): ComposedState<State> {
  const moduleBefore = composed.module;
  const moduleAfter = module.reduce(moduleBefore, event, rules);
  const ctx: PlatformReducerContext<Rules, Result, LiveInput, State, BetTarget, Action> = {
    module,
    rules,
    moduleBefore,
    moduleAfter,
  };
  const platformAfter = reducePlatform(composed.platform, event, ctx);
  return { module: moduleAfter, platform: platformAfter };
}

export function replay<Rules, Result, LiveInput, State, BetTarget = unknown, Action = never>(
  events: TableEvent[],
  module: GameModule<Rules, Result, LiveInput, State, BetTarget, Action>,
  rules: Rules,
  options: ReplayOptions = {},
): ComposedState<State> {
  const persisted = events.filter(isPersistedEvent);

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
