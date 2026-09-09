import {
  DEFAULT_TABLE_SETTINGS,
  replay,
  resolveEffectiveRules,
  stableStringify,
  tableCodeFrom,
  type ComposedState,
  type GameId,
  type ResultEnvelope,
  type TableEvent,
  type TableEventType,
} from "@casino-lord/core";
import { saveTableEvents } from "./persistence.js";
import { buildTableMeta } from "./meta.js";
import type { UntypedGameModule } from "./module-types.js";

type TableEventInput = { type: TableEventType } & Record<string, unknown>;

export type Listener = () => void;

export interface TableStore {
  readonly code: string;
  readonly game: GameId;
  readonly events: readonly TableEvent[];
  getComposed(): ComposedState<unknown>;
  getRules(): unknown;
  getTableMeta(): ReturnType<typeof buildTableMeta>;
  emit: (body: TableEventInput) => void;
  record(result: unknown, opts: { quick: boolean }): void;
  undoLastResult(): void;
  editResult(result: ResultEnvelope<unknown>): void;
  deleteResult(resultId: string): void;
  startNewSeries(label?: string, opts?: { auto?: boolean }): void;
  endSession(): void;
  importResults(results: unknown[]): void;
  subscribe(listener: Listener): () => void;
}

export interface CreateTableOptions {
  game: GameId;
  module: UntypedGameModule;
  rules: unknown;
  rng?: () => number;
  now?: () => string;
  id?: () => string;
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultId(): string {
  return crypto.randomUUID();
}

function defaultRng(): number {
  return Math.floor(Math.random() * 0x100000000);
}

export function createTableStore(options: CreateTableOptions): TableStore {
  const { game, module, rules, rng = defaultRng, now = defaultNow, id = defaultId } = options;

  const code = tableCodeFrom(() => rng() % 32);
  const listeners = new Set<Listener>();
  const events: TableEvent[] = [];
  let seq = 0;

  const notify = (): void => {
    for (const l of listeners) l();
  };

  const append = (body: TableEventInput): TableEvent => {
    seq += 1;
    const event = { seq, at: now(), ...body } as TableEvent;
    events.push(event);
    void saveTableEvents(code, game, events);
    notify();
    return event;
  };

  append({
    type: "TABLE_CREATED",
    game,
    participation: DEFAULT_TABLE_SETTINGS.participation,
    settings: { ...DEFAULT_TABLE_SETTINGS, rules },
  });

  append({
    type: "SERIES_STARTED",
    seriesId: id(),
    label: module.seriesLabel,
  });

  const getComposed = (): ComposedState<unknown> =>
    replay(events, module, rules, { code, includeEphemeral: true });

  const getRules = (): unknown => {
    const composed = getComposed();
    return resolveEffectiveRules(rules, composed.platform.settings.rules);
  };

  const getTableMeta = () => {
    const composed = getComposed();
    return buildTableMeta(composed, events, module, composed.module);
  };

  const emit = (body: TableEventInput): void => {
    append(body);
  };

  const record = (result: unknown, opts: { quick: boolean }): void => {
    const composed = getComposed();
    const results = (composed.module as { results?: unknown[] }).results;
    const index = Array.isArray(results) ? results.length : 0;
    const envelope: ResultEnvelope<unknown> = {
      id: id(),
      index,
      recordedAt: now(),
      quick: opts.quick,
      source: "physical",
      by: "dealer",
      data: result,
    };
    append({ type: "RESULT_RECORDED", result: envelope });
  };

  const undoLastResult = (): void => {
    const composed = getComposed();
    const results = (composed.module as { results?: { id: string }[] }).results;
    if (!Array.isArray(results) || results.length === 0) return;
    const last = results[results.length - 1]!;
    append({ type: "RESULT_UNDONE", resultId: last.id });
  };

  const editResult = (result: ResultEnvelope<unknown>): void => {
    append({ type: "RESULT_EDITED", result });
  };

  const deleteResult = (resultId: string): void => {
    append({ type: "RESULT_DELETED", resultId });
  };

  const startNewSeries = (label?: string, opts?: { auto?: boolean }): void => {
    append({
      type: "SERIES_STARTED",
      seriesId: id(),
      ...(label !== undefined ? { label } : {}),
      ...(opts?.auto ? { auto: true } : {}),
    });
  };

  const endSession = (): void => {
    append({ type: "SESSION_ENDED" });
  };

  const importResults = (results: unknown[]): void => {
    for (const data of results) {
      record(data, { quick: true });
    }
  };

  return {
    get code() {
      return code;
    },
    get game() {
      return game;
    },
    get events() {
      return events;
    },
    getComposed,
    getRules,
    getTableMeta,
    emit,
    record,
    undoLastResult,
    editResult,
    deleteResult,
    startNewSeries,
    endSession,
    importResults,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function reopenTableStore(input: {
  code: string;
  game: GameId;
  module: UntypedGameModule;
  rules: unknown;
  events: TableEvent[];
  now?: () => string;
  id?: () => string;
}): TableStore {
  const { code, game, module, rules, events: initialEvents } = input;
  const now = input.now ?? defaultNow;
  const idGen = input.id ?? defaultId;
  const listeners = new Set<Listener>();
  const events = [...initialEvents];
  let seq = events.reduce((max, e) => Math.max(max, e.seq), 0);

  const notify = (): void => {
    for (const l of listeners) l();
  };

  const append = (body: TableEventInput): TableEvent => {
    seq += 1;
    const event = { seq, at: now(), ...body } as TableEvent;
    events.push(event);
    void saveTableEvents(code, game, events);
    notify();
    return event;
  };

  const getComposed = (): ComposedState<unknown> =>
    replay(events, module, rules, { code, includeEphemeral: true });

  const getRules = (): unknown => {
    const composed = getComposed();
    return resolveEffectiveRules(rules, composed.platform.settings.rules);
  };

  const getTableMeta = () => {
    const composed = getComposed();
    return buildTableMeta(composed, events, module, composed.module);
  };

  const emit = (body: TableEventInput): void => {
    append(body);
  };
  const record = (result: unknown, opts: { quick: boolean }): void => {
    const composed = getComposed();
    const results = (composed.module as { results?: unknown[] }).results;
    const index = Array.isArray(results) ? results.length : 0;
    append({
      type: "RESULT_RECORDED",
      result: {
        id: idGen(),
        index,
        recordedAt: now(),
        quick: opts.quick,
        source: "physical",
        by: "dealer",
        data: result,
      },
    });
  };

  return {
    get code() {
      return code;
    },
    get game() {
      return game;
    },
    get events() {
      return events;
    },
    getComposed,
    getRules,
    getTableMeta,
    emit,
    record,
    undoLastResult: () => {
      const composed = getComposed();
      const results = (composed.module as { results?: { id: string }[] }).results;
      if (!Array.isArray(results) || results.length === 0) return;
      append({ type: "RESULT_UNDONE", resultId: results[results.length - 1]!.id });
    },
    editResult: (result) => append({ type: "RESULT_EDITED", result }),
    deleteResult: (resultId) => append({ type: "RESULT_DELETED", resultId }),
    startNewSeries: (label) =>
      append({
        type: "SERIES_STARTED",
        seriesId: idGen(),
        ...(label !== undefined ? { label } : {}),
      }),
    endSession: () => append({ type: "SESSION_ENDED" }),
    importResults: (results) => {
      for (const data of results) record(data, { quick: true });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function composedStateFingerprint(store: TableStore): string {
  return stableStringify(store.getComposed());
}
