import type { Component } from "preact";
import type { ZodSchema } from "zod";
import type { GameModule } from "../game-module.js";
import type { TableEvent, TableEventType } from "../events.js";
import type { Series } from "../data-model.js";
import type { PlacedBet } from "../data-model.js";
import type { Settlement } from "../betting.js";
import { DEFAULT_TABLE_SETTINGS } from "../settings.js";
import type { TableSettings } from "../settings.js";

export interface StubRules {
  threshold: number;
}

export interface StubResult {
  value: number;
}

export interface StubLiveInput {
  value?: number;
}

export interface StubResultEntry {
  id: string;
  value: number;
}

export interface StubState {
  results: StubResultEntry[];
  sum: number;
}

function recomputeSum(results: StubResultEntry[]): number {
  return results.reduce((acc, r) => acc + r.value, 0);
}

function stubComponent(): Component<Record<string, unknown>> {
  return (() => null) as unknown as Component<Record<string, unknown>>;
}

function emptySchema<T>(): ZodSchema<T> {
  return {} as ZodSchema<T>;
}

export function createStubModule(): GameModule<
  StubRules,
  StubResult,
  StubLiveInput,
  StubState,
  unknown,
  never
> {
  return {
    id: "baccarat",
    name: "Stub",
    seriesLabel: "Session",
    resultLabel: "Round",

    defaultRules: { threshold: 10 },
    rulesSchema: emptySchema<StubRules>(),
    resultSchema: emptySchema<StubResult>(),
    liveInputSchema: emptySchema<StubLiveInput>(),
    betTargetSchema: emptySchema<unknown>(),

    initialState(): StubState {
      return { results: [], sum: 0 };
    },

    confirm(): null {
      return null;
    },

    reduce(state: StubState, event: TableEvent, _rules: StubRules): StubState {
      switch (event.type) {
        case "RESULT_RECORDED": {
          const data = event.result.data as StubResult;
          const results = [...state.results, { id: event.result.id, value: data.value }];
          return { results, sum: recomputeSum(results) };
        }
        case "RESULT_EDITED": {
          const data = event.result.data as StubResult;
          const idx = state.results.findIndex((r) => r.id === event.result.id);
          if (idx < 0) return state;
          const results = state.results.map((r, i) =>
            i === idx ? { id: event.result.id, value: data.value } : r,
          );
          return { results, sum: recomputeSum(results) };
        }
        case "RESULT_DELETED": {
          const results = state.results.filter((r) => r.id !== event.resultId);
          return { results, sum: recomputeSum(results) };
        }
        case "RESULT_UNDONE": {
          const results = state.results.filter((r) => r.id !== event.resultId);
          return { results, sum: recomputeSum(results) };
        }
        default:
          return state;
      }
    },

    DealerView: stubComponent() as GameModule<
      StubRules,
      StubResult,
      StubLiveInput,
      StubState
    >["DealerView"],
    DisplayView: stubComponent() as GameModule<
      StubRules,
      StubResult,
      StubLiveInput,
      StubState
    >["DisplayView"],
    PlayerView: stubComponent() as GameModule<
      StubRules,
      StubResult,
      StubLiveInput,
      StubState
    >["PlayerView"],
    ResultDetailView: stubComponent() as GameModule<
      StubRules,
      StubResult,
      StubLiveInput,
      StubState
    >["ResultDetailView"],
    RulesSettingsView: stubComponent() as GameModule<
      StubRules,
      StubResult,
      StubLiveInput,
      StubState
    >["RulesSettingsView"],

    bets: {
      groups: [
        {
          id: "main",
          label: "Main",
          bets: [
            {
              id: "high",
              label: "High",
              lifecycle: "round",
              pays: () => ({ num: 1, den: 1 }),
            },
          ],
        },
      ],
      summary: () => [],
    },

    settle(input: { bets: PlacedBet[]; result: StubResult; rules: StubRules }): Settlement[] {
      return input.bets.map((bet) => {
        const wins = input.result.value >= input.rules.threshold;
        if (bet.type !== "high") {
          return { betId: bet.id, outcome: "lose", returned: 0, profit: -bet.amount };
        }
        if (wins) {
          return {
            betId: bet.id,
            outcome: "win",
            returned: bet.amount * 2,
            profit: bet.amount,
          };
        }
        return { betId: bet.id, outcome: "lose", returned: 0, profit: -bet.amount };
      });
    },

    animationEvents: [],
    deriveAnimations: () => [],
    stats: () => [],
    layouts: [{ id: "default", label: "Default" }],

    exportSeries(series: Series<StubResult>): string {
      return series.results.map((r) => String((r.data as StubResult).value)).join(",");
    },

    importSeries(text: string): { results: StubResult[]; warnings: string[] } {
      const results = text
        .split(",")
        .filter(Boolean)
        .map((s) => ({ value: Number(s) }));
      return { results, warnings: [] };
    },
  };
}

export const STUB_RULES: StubRules = { threshold: 10 };

export function ev(
  seq: number,
  at: string,
  body: Record<string, unknown> & { type: TableEventType },
): TableEvent {
  return { seq, at, ...body } as TableEvent;
}

export function resultEnvelope(
  id: string,
  index: number,
  value: number,
  roundId?: string,
): {
  id: string;
  index: number;
  recordedAt: string;
  quick: boolean;
  source: "physical";
  by: "dealer";
  data: StubResult;
  roundId?: string;
} {
  return {
    id,
    index,
    recordedAt: atIso(index),
    quick: false,
    source: "physical",
    by: "dealer",
    data: { value },
    ...(roundId !== undefined ? { roundId } : {}),
  };
}

function atIso(n: number): string {
  return `2026-01-01T00:00:${String(n).padStart(2, "0")}.000Z`;
}

export function houseSettings(): TableSettings {
  return {
    ...DEFAULT_TABLE_SETTINGS,
    participation: { playerMode: "on", bank: "house", outcomeSource: "physical" },
  };
}
