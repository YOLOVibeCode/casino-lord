import {
  canUndoResult,
  DEFAULT_TABLE_SETTINGS,
  replay,
  resolveEffectiveRules,
  stableStringify,
  tableCodeFrom,
  type ComposedState,
  type GameId,
  type Participation,
  type ResultEnvelope,
  type TableEvent,
  type TableEventType,
} from "@casino-lord/core";
import { buildResultEnvelope } from "../betting/build-result-envelope.js";
import { loadVirtualState, saveTableEvents, saveVirtualState } from "./persistence.js";
import { buildTableMeta } from "./meta.js";
import type { UntypedGameModule } from "./module-types.js";
import type { VirtualPendingState, VirtualStatus } from "./sync-store-types.js";
import {
  VirtualDealer,
  buildVirtualStatus,
  defaultActionForModule,
  resolveVirtualRequest,
} from "./virtual-dealer.js";
import { executeLocalVirtualStep } from "./virtual-executor.js";

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
  canUndoLastResult(): { ok: boolean; reason?: string };
  undoLastResult(): void;
  editResult(result: ResultEnvelope<unknown>): void;
  deleteResult(resultId: string): void;
  startNewSeries(label?: string, opts?: { auto?: boolean }): void;
  endSession(): void;
  importResults(results: unknown[]): void;
  sendVirtual(kind: "trigger" | "action" | "force", payload?: unknown): void;
  getVirtualStatus?(): VirtualStatus | null;
  getVirtualPending?(): VirtualPendingState | null;
  subscribe(listener: Listener): () => void;
}

export interface CreateTableOptions {
  game: GameId;
  module: UntypedGameModule;
  rules: unknown;
  participation?: Participation;
  virtualSeed?: Uint8Array;
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

function isVirtualParticipation(participation: Participation): boolean {
  return participation.outcomeSource === "virtual";
}

function isMixedSeriesEvent(body: TableEventInput): boolean {
  return body.type === "RESULT_RECORDED" || body.type === "LIVE_INPUT";
}

interface StoreInternals {
  code: string;
  game: GameId;
  module: UntypedGameModule;
  rules: unknown;
  events: TableEvent[];
  listeners: Set<Listener>;
  now: () => string;
  id: () => string;
  virtualDealer: VirtualDealer | null;
  virtualStatus: VirtualStatus | null;
  virtualPending: VirtualPendingState | null;
  seq: number;
}

function buildStore(internals: StoreInternals): TableStore {
  const { code, game, module, rules, listeners, now, id } = internals;
  let { virtualDealer, virtualStatus, virtualPending } = internals;

  const notify = (): void => {
    for (const l of listeners) l();
  };

  let cachedComposed: ComposedState<unknown> | null = null;
  let composedCacheKey = "";

  const invalidateComposedCache = (): void => {
    cachedComposed = null;
    composedCacheKey = "";
  };

  const composedCacheKeyFor = (): string => `${internals.events.length}:${internals.seq}`;

  const getComposed = (): ComposedState<unknown> => {
    const key = composedCacheKeyFor();
    if (cachedComposed && composedCacheKey === key) {
      return cachedComposed;
    }
    cachedComposed = replay(internals.events, module, rules, { code, includeEphemeral: true });
    composedCacheKey = key;
    return cachedComposed;
  };

  const getRules = (): unknown => {
    const composed = getComposed();
    return resolveEffectiveRules(rules, composed.platform.settings.rules);
  };

  const ctx = { getComposed, getRules };

  const isVirtual = (): boolean => getComposed().platform.participation.outcomeSource === "virtual";

  const persistVirtualState = (): void => {
    if (!virtualDealer) return;
    const exported = virtualDealer.exportState();
    void saveVirtualState({
      code,
      seriesId: exported.seriesId,
      seedHex: exported.seedHex,
      session: exported.session,
      awaiting: exported.awaiting,
    });
  };

  const refreshVirtualStatus = (): void => {
    if (!virtualDealer || !isVirtual()) {
      virtualStatus = null;
      return;
    }
    virtualStatus = buildVirtualStatus(ctx, module, virtualDealer);
  };

  const appendAt = (body: TableEventInput, at: string): TableEvent => {
    invalidateComposedCache();
    internals.seq += 1;
    const event = { seq: internals.seq, at, ...body } as TableEvent;
    internals.events.push(event);
    void saveTableEvents(code, game, internals.events);
    notify();
    return event;
  };

  const append = (body: TableEventInput): TableEvent => appendAt(body, now());

  const appendPersisted = (body: TableEventInput, at: string): TableEvent => {
    const event = appendAt(body, at);
    persistVirtualState();
    refreshVirtualStatus();
    return event;
  };

  refreshVirtualStatus();

  const emit = (body: TableEventInput): void => {
    if (isVirtual() && isMixedSeriesEvent(body)) {
      return;
    }
    append(body);
  };

  const record = (result: unknown, opts: { quick: boolean }): void => {
    if (isVirtual()) {
      return;
    }
    const composed = getComposed();
    const envelope = buildResultEnvelope(composed, result, {
      id: id(),
      now: now(),
      quick: opts.quick,
    });
    append({ type: "RESULT_RECORDED", result: envelope });
  };

  const canUndoLastResult = (): { ok: boolean; reason?: string } => {
    const composed = getComposed();
    const results = composed.platform.results;
    if (results.length === 0) {
      return { ok: false, reason: "No result to undo." };
    }
    const last = results[results.length - 1]!;
    return canUndoResult(composed.platform, last.id);
  };

  const undoLastResult = (): void => {
    const check = canUndoLastResult();
    if (!check.ok) return;
    const composed = getComposed();
    const results = composed.platform.results;
    if (results.length === 0) return;
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
    if (isVirtual() && virtualDealer) {
      const rotated = virtualDealer.rotateSeries(opts?.auto ?? false, label, id());
      for (const event of rotated) {
        appendPersisted(event as TableEventInput, now());
      }
      return;
    }
    append({
      type: "SERIES_STARTED",
      seriesId: id(),
      ...(label !== undefined ? { label } : {}),
      ...(opts?.auto ? { auto: true } : {}),
    });
  };

  const endSession = (): void => {
    if (isVirtual() && virtualDealer) {
      appendPersisted(virtualDealer.endSeriesEvent() as TableEventInput, now());
    }
    append({ type: "SESSION_ENDED" });
  };

  const importResults = (results: unknown[]): void => {
    for (const data of results) {
      record(data, { quick: true });
    }
  };

  const sendVirtual = (kind: "trigger" | "action" | "force", payload?: unknown): void => {
    if (!isVirtual() || !virtualDealer || !module.virtual) {
      return;
    }

    if (virtualDealer.dealing) {
      return;
    }

    let forceDefault: unknown;
    if (kind === "force" && virtualDealer.awaiting === "action") {
      try {
        forceDefault = defaultActionForModule(module);
      } catch {
        return;
      }
    }

    const composed = getComposed();
    const turn = module.turn?.(composed.module);
    const turnPlayerId =
      kind === "force" && virtualDealer.awaiting === "action"
        ? (turn?.playerId ?? undefined)
        : undefined;

    const request = resolveVirtualRequest(kind, module, payload, turnPlayerId, forceDefault);
    if (!request) {
      return;
    }

    executeLocalVirtualStep({
      ctx,
      module,
      virtualDealer,
      request,
      id,
      appendPersisted: (event, at) => {
        appendPersisted(event as TableEventInput, at);
      },
      onEphemeral: () => {
        notify();
      },
      onVirtualStatus: () => {
        refreshVirtualStatus();
        notify();
      },
      onVirtualPending: (pending) => {
        virtualPending = pending;
        notify();
      },
      getVirtualSettings: () => getComposed().platform.settings.virtual,
      onComplete: () => {
        persistVirtualState();
        refreshVirtualStatus();
        notify();
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
      return internals.events;
    },
    getComposed,
    getRules,
    getTableMeta: () => {
      const composed = getComposed();
      return buildTableMeta(composed, internals.events, module, composed.module);
    },
    emit,
    record,
    canUndoLastResult,
    undoLastResult,
    editResult,
    deleteResult,
    startNewSeries,
    endSession,
    importResults,
    sendVirtual,
    getVirtualStatus: () => virtualStatus,
    getVirtualPending: () => virtualPending,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createTableStore(options: CreateTableOptions): TableStore {
  const {
    game,
    module,
    rules,
    participation = DEFAULT_TABLE_SETTINGS.participation,
    virtualSeed,
    rng = defaultRng,
    now = defaultNow,
    id = defaultId,
  } = options;

  const code = tableCodeFrom(() => rng() % 32);
  const listeners = new Set<Listener>();
  const events: TableEvent[] = [];
  const isVirtual = isVirtualParticipation(participation);

  let virtualDealer: VirtualDealer | null = null;
  const seriesId = id();

  if (isVirtual) {
    virtualDealer = new VirtualDealer(code, seriesId, virtualSeed);
  }

  const internals: StoreInternals = {
    code,
    game,
    module,
    rules,
    events,
    listeners,
    now,
    id,
    virtualDealer,
    virtualStatus: null,
    virtualPending: null,
    seq: 0,
  };

  const append = (body: TableEventInput): void => {
    internals.seq += 1;
    const event = { seq: internals.seq, at: now(), ...body } as TableEvent;
    events.push(event);
    void saveTableEvents(code, game, events);
    for (const l of listeners) l();
  };

  append({
    type: "TABLE_CREATED",
    game,
    participation,
    settings: { ...DEFAULT_TABLE_SETTINGS, participation, rules },
  });

  if (isVirtual && virtualDealer) {
    append(virtualDealer.startSeriesEvent(module.seriesLabel) as TableEventInput);
    void saveVirtualState({
      code,
      seriesId: virtualDealer.seriesId,
      seedHex: virtualDealer.getSeedHex(),
      session: virtualDealer.session,
      awaiting: virtualDealer.awaiting,
    });
  } else {
    append({
      type: "SERIES_STARTED",
      seriesId,
      label: module.seriesLabel,
    });
  }

  return buildStore(internals);
}

export function reopenTableStore(input: {
  code: string;
  game: GameId;
  module: UntypedGameModule;
  rules: unknown;
  events: TableEvent[];
  now?: () => string;
  id?: () => string;
  virtualState?: Awaited<ReturnType<typeof loadVirtualState>>;
}): TableStore {
  const { code, game, module, rules, events: initialEvents } = input;
  const now = input.now ?? defaultNow;
  const idGen = input.id ?? defaultId;
  const listeners = new Set<Listener>();
  const events = [...initialEvents];
  const seq = events.reduce((max, e) => Math.max(max, e.seq), 0);

  const composed = replay(events, module, rules, { code, includeEphemeral: true });
  const isVirtual = composed.platform.participation.outcomeSource === "virtual";

  let virtualDealer: VirtualDealer | null = null;
  if (isVirtual) {
    const lastSeriesStart = [...events].reverse().find((e) => e.type === "SERIES_STARTED");
    const seriesId =
      lastSeriesStart?.type === "SERIES_STARTED" ? lastSeriesStart.seriesId : idGen();
    virtualDealer = new VirtualDealer(code, seriesId);
    const saved = input.virtualState;
    if (saved && saved.seriesId === seriesId) {
      virtualDealer.restoreState(saved);
    }
  }

  const internals: StoreInternals = {
    code,
    game,
    module,
    rules,
    events,
    listeners,
    now,
    id: idGen,
    virtualDealer,
    virtualStatus: null,
    virtualPending: null,
    seq,
  };

  return buildStore(internals);
}

export function composedStateFingerprint(store: TableStore): string {
  return stableStringify(store.getComposed());
}

export {
  attachSoloBroadcastChannel,
  createSoloDisplayStore,
  createSoloPlayerStore,
  isSoloBroadcastChannelAvailable,
  joinSoloPlayer,
  rejoinSoloPlayer,
  soloLocalUrl,
  waitForSoloSnapshot,
} from "./solo-channel.js";
export type {
  AttachSoloBroadcastChannelOptions,
  SoloBroadcastChannelHandle,
} from "./solo-channel.js";
