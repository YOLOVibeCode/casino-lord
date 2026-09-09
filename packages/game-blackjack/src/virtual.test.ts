import { describe, expect, it } from "vitest";
import { blackjackModule } from "./module.js";
import { initialState } from "./state.js";
import { reduce } from "./reducer.js";
import { createDeterministicRng } from "./virtual.js";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";
import type { TableEvent } from "@casino-lord/core";

function applyEvents(
  events: Omit<TableEvent, "seq" | "at">[],
  start = initialState(),
): ReturnType<typeof reduce> {
  let state = start;
  events.forEach((e, i) => {
    state = reduce(
      state,
      { ...e, seq: i + 1, at: `2026-01-01T00:00:${i}.000Z` } as TableEvent,
      DEFAULT_BLACKJACK_RULES,
    );
  });
  return state;
}

describe("virtual play", () => {
  const virtual = blackjackModule.virtual!;

  it("fixed seed produces identical deal sequence", () => {
    const rng1 = createDeterministicRng(42);
    const rng2 = createDeterministicRng(42);
    const state = initialState();

    const run = (rng: typeof rng1) => {
      const events: Omit<TableEvent, "seq" | "at">[] = [];
      let s = state;
      let step = virtual.step({ state: s, rules: DEFAULT_BLACKJACK_RULES, rng, trigger: "deal" });
      events.push(...step.events);
      s = applyEvents(step.events, s);
      while (step.awaiting !== "none" && events.length < 20) {
        step = virtual.step({
          state: s,
          rules: DEFAULT_BLACKJACK_RULES,
          rng,
          trigger: "deal",
          ...(step.awaiting === "action" ? { action: { playerId: "p1", action: "stand" } } : {}),
        });
        events.push(...step.events);
        s = applyEvents(step.events, s);
      }
      return events;
    };

    expect(JSON.stringify(run(rng1))).toBe(JSON.stringify(run(rng2)));
  });

  it("peek deals hole card before player turns", () => {
    const rules = { ...DEFAULT_BLACKJACK_RULES, peek: true };
    const rng = createDeterministicRng(7);
    let state = initialState(rules);
    let step = virtual.step({ state, rules, rng, trigger: "deal" });
    state = applyEvents(step.events, state);
    step = virtual.step({ state, rules, rng, trigger: "deal" });
    state = applyEvents(step.events, state);
    expect(state.liveInput.dealer.length).toBeGreaterThanOrEqual(2);
  });

  it("ENHC delays hole card until dealer phase", () => {
    const rules = { ...DEFAULT_BLACKJACK_RULES, peek: false };
    const rng = createDeterministicRng(7);
    let state = initialState(rules);
    let step = virtual.step({ state, rules, rng, trigger: "deal" });
    state = applyEvents(step.events, state);
    step = virtual.step({ state, rules, rng, trigger: "deal" });
    state = applyEvents(step.events, state);
    expect(state.liveInput.virtual?.holeDealt).toBe(false);
  });
});
