import { describe, expect, it } from "vitest";
import type { GameModule } from "../game-module.js";
import type { PlacedBet, Series } from "../data-model.js";
import type { TableEvent } from "../events.js";
import { createSeededRng } from "../rng.js";
import { assertReplayDeterministic, replay, stableStringify } from "../replay.js";
import { triggerForKind } from "../platform-types.js";
import type { VirtualTrigger } from "../platform-types.js";

export interface SettleScenario<Result, State, BetTarget> {
  bets: PlacedBet<BetTarget>[];
  result: Result;
  before: State;
  after: State;
}

export interface VirtualStepFixture<State> {
  moduleState: State;
  trigger?: VirtualTrigger;
  seed: Uint8Array;
  /** Platform-only event that must not change module state (e.g. BET_PLACED). */
  betsIsolationEvent?: TableEvent;
}

export interface GameModuleContractFixtures<Rules, Result, LiveInput, State, BetTarget> {
  rules?: Rules;
  validResults: Result[];
  validLiveInputs: LiveInput[];
  validBetTargets: BetTarget[];
  invalidResults?: unknown[];
  invalidLiveInputs?: unknown[];
  invalidBetTargets?: unknown[];
  exportSeriesText: string;
  replayEvents: TableEvent[];
  reduceEvent?: TableEvent;
  reduceState?: State;
  settleScenario?: SettleScenario<Result, State, BetTarget>;
  virtualStep?: VirtualStepFixture<State>;
}

export function collectCatalogueBetIds<Rules, Result, LiveInput, State, BetTarget, Action>(
  module: GameModule<Rules, Result, LiveInput, State, BetTarget, Action>,
): Set<string> {
  const ids = new Set<string>();
  for (const group of module.bets.groups) {
    for (const bet of group.bets) {
      ids.add(bet.id);
    }
  }
  return ids;
}

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function toSeries<R>(results: R[]): Series<R> {
  return {
    id: "contract",
    number: 1,
    startedAt: "2026-01-01T00:00:00.000Z",
    results: results.map((data, index) => ({
      id: `r${index}`,
      index,
      recordedAt: `2026-01-01T00:00:${String(index).padStart(2, "0")}.000Z`,
      quick: false,
      source: "physical" as const,
      by: "dealer" as const,
      data,
    })),
    rounds: [],
  };
}

export function describeGameModuleContract<
  Rules,
  Result,
  LiveInput,
  State,
  BetTarget,
  Action = never,
>(
  module: GameModule<Rules, Result, LiveInput, State, BetTarget, Action>,
  fixtures: GameModuleContractFixtures<Rules, Result, LiveInput, State, BetTarget>,
): void {
  const rules = fixtures.rules ?? module.defaultRules;
  const catalogueIds = collectCatalogueBetIds(module);

  describe("GameModule contract", () => {
    it("rulesSchema parses defaultRules", () => {
      expect(module.rulesSchema.safeParse(module.defaultRules).success).toBe(true);
    });

    it("resultSchema accepts valid fixtures and rejects garbage", () => {
      for (const value of fixtures.validResults) {
        expect(module.resultSchema.safeParse(value).success).toBe(true);
      }
      for (const value of fixtures.invalidResults ?? [{ not: "a result" }]) {
        expect(module.resultSchema.safeParse(value).success).toBe(false);
      }
    });

    it("liveInputSchema accepts valid fixtures and rejects garbage", () => {
      for (const value of fixtures.validLiveInputs) {
        expect(module.liveInputSchema.safeParse(value).success).toBe(true);
      }
      for (const value of fixtures.invalidLiveInputs ?? [{ not: "live input" }]) {
        expect(module.liveInputSchema.safeParse(value).success).toBe(false);
      }
    });

    it("betTargetSchema accepts valid fixtures and rejects garbage", () => {
      for (const value of fixtures.validBetTargets) {
        expect(module.betTargetSchema.safeParse(value).success).toBe(true);
      }
      for (const value of fixtures.invalidBetTargets ?? ["__invalid_bet__"]) {
        expect(module.betTargetSchema.safeParse(value).success).toBe(false);
      }
    });

    it("initialState(rules) is deterministic", () => {
      const a = module.initialState(rules);
      const b = module.initialState(rules);
      expect(stableStringify(a)).toBe(stableStringify(b));
    });

    it("reduce is pure and does not mutate inputs", () => {
      const baseState = fixtures.reduceState ?? module.initialState(rules);
      const event =
        fixtures.reduceEvent ??
        fixtures.replayEvents.find((e) => e.type === "RESULT_RECORDED") ??
        fixtures.replayEvents[fixtures.replayEvents.length - 1]!;

      const frozenState = deepClone(baseState);
      const frozenEvent = deepClone(event);
      const frozenRules = deepClone(rules);

      const out1 = module.reduce(
        deepClone(frozenState),
        deepClone(frozenEvent),
        deepClone(frozenRules),
      );
      const out2 = module.reduce(
        deepClone(frozenState),
        deepClone(frozenEvent),
        deepClone(frozenRules),
      );
      expect(stableStringify(out1)).toBe(stableStringify(out2));

      const stateMut = deepClone(frozenState);
      const eventMut = deepClone(frozenEvent);
      const rulesMut = deepClone(frozenRules);
      const stateBefore = stableStringify(stateMut);
      const eventBefore = stableStringify(eventMut);
      const rulesBefore = stableStringify(rulesMut);
      module.reduce(stateMut, eventMut, rulesMut);
      expect(stableStringify(stateMut)).toBe(stateBefore);
      expect(stableStringify(eventMut)).toBe(eventBefore);
      expect(stableStringify(rulesMut)).toBe(rulesBefore);
    });

    it("replay is deterministic for fixture log", () => {
      expect(() => assertReplayDeterministic(fixtures.replayEvents, module, rules)).not.toThrow();
    });

    it("settle returns integer profit/returned and known bet types", () => {
      const scenario =
        fixtures.settleScenario ??
        (() => {
          const state = module.initialState(rules);
          const firstBetId = catalogueIds.values().next().value as string;
          const bet: PlacedBet<BetTarget> = {
            id: "contract-bet",
            playerId: "p1",
            roundId: "r1",
            type: firstBetId,
            amount: 100,
            declared: false,
            working: false,
            placedAt: "2026-01-01T00:00:01.000Z",
            originRoundId: "r1",
          };
          return {
            bets: [bet],
            result: fixtures.validResults[0]!,
            before: state,
            after: state,
          };
        })();

      const settlements = module.settle({
        bets: scenario.bets,
        result: scenario.result,
        before: scenario.before,
        after: scenario.after,
        rules,
      });

      for (const s of settlements) {
        expect(Number.isInteger(s.profit)).toBe(true);
        expect(Number.isInteger(s.returned)).toBe(true);
        const bet = scenario.bets.find((b) => b.id === s.betId);
        expect(bet).toBeDefined();
        expect(catalogueIds.has(bet!.type as string)).toBe(true);
      }
    });

    it("importSeries and exportSeries round-trip", () => {
      const imported = module.importSeries(fixtures.exportSeriesText, rules);
      expect("error" in imported).toBe(false);
      if ("error" in imported) return;

      const series = toSeries(imported.results);
      const exported = module.exportSeries(series, rules);
      const reimported = module.importSeries(exported, rules);
      expect("error" in reimported).toBe(false);
      if ("error" in reimported) return;
      expect(reimported.results.length).toBe(imported.results.length);
      expect(stableStringify(reimported.results)).toBe(stableStringify(imported.results));
    });

    it("bets.summary returns string labels", () => {
      const state = module.initialState(rules);
      const rows = module.bets.summary([], state);
      for (const row of rows) {
        expect(typeof row.label).toBe("string");
      }
    });

    if (module.virtual) {
      it("virtual.step is deterministic for a seeded Rng", () => {
        const vs = fixtures.virtualStep ?? {
          moduleState: module.initialState(rules),
          seed: new Uint8Array(32).fill(1),
        };
        const trigger = vs.trigger ?? triggerForKind(module.virtual!.kind);
        const rng1 = createSeededRng(vs.seed);
        const rng2 = createSeededRng(vs.seed);
        const out1 = module.virtual!.step({
          state: vs.moduleState,
          rules,
          rng: rng1,
          trigger,
        });
        const out2 = module.virtual!.step({
          state: vs.moduleState,
          rules,
          rng: rng2,
          trigger,
        });
        expect(stableStringify(out1)).toBe(stableStringify(out2));
      });

      it("virtual.step does not observe platform bets", () => {
        const vs = fixtures.virtualStep ?? {
          moduleState: module.initialState(rules),
          seed: new Uint8Array(32).fill(2),
        };
        const isolationEvent = vs.betsIsolationEvent;
        if (!isolationEvent) return;

        const base = replay(fixtures.replayEvents, module, rules).module;
        const withBet = replay([...fixtures.replayEvents, isolationEvent], module, rules).module;
        expect(stableStringify(base)).toBe(stableStringify(withBet));

        const trigger = vs.trigger ?? triggerForKind(module.virtual!.kind);
        const rngA = createSeededRng(vs.seed);
        const rngB = createSeededRng(vs.seed);
        const stepBase = module.virtual!.step({ state: base, rules, rng: rngA, trigger });
        const stepWithBet = module.virtual!.step({ state: withBet, rules, rng: rngB, trigger });
        expect(stableStringify(stepBase)).toBe(stableStringify(stepWithBet));
      });
    }
  });
}
