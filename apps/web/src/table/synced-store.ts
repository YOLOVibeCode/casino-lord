import {
  canUndoResult,
  replay,
  resolveEffectiveRules,
  type ComposedState,
  type GameId,
  type ResultEnvelope,
  type TableEvent,
  type TableEventType,
} from "@casino-lord/core";
import { buildResultEnvelope } from "../betting/build-result-envelope.js";
import { io, type Socket } from "socket.io-client";
import { newClientId } from "../sync/client-id.js";
import { saveDealerToken } from "../sync/dealer-token.js";
import { savePlayerToken } from "../sync/player-token.js";
import { getGame } from "./games.js";
import { buildTableMeta } from "./meta.js";
import type { UntypedGameModule } from "./module-types.js";
import { enqueueOfflineEvent, peekOfflineQueue, shiftOfflineQueue } from "./offline-queue.js";
import { loadTable, saveTableEvents } from "./persistence.js";
import type {
  ConnectionState,
  PendingPlayerEntry,
  SyncPresence,
  SyncStore,
  VirtualPendingState,
  VirtualStatus,
} from "./sync-store-types.js";
import type { Listener } from "./store.js";

type TableEventInput = { type: TableEventType } & Record<string, unknown>;

interface PendingEmit {
  clientId: string;
  eventIndex: number;
}

export interface CreateSyncedStoreOptions {
  code: string;
  role: "dealer" | "display" | "player";
  token?: string;
  syncUrl: string;
  module: UntypedGameModule;
  rules: unknown;
  takeover?: boolean;
  now?: () => string;
  id?: () => string;
  onJoinError?: (code: string) => void;
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultId(): string {
  return crypto.randomUUID();
}

function waitUntil(fn: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = (): void => {
      if (fn()) {
        resolve();
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error("timeout"));
        return;
      }
      setTimeout(tick, 20);
    };
    tick();
  });
}

const testSockets = new WeakMap<SyncStore, Socket>();
const testMessageHandlers = new WeakMap<SyncStore, (msg: Record<string, unknown>) => void>();

export function disconnectSyncStoreForTest(store: SyncStore): void {
  testSockets.get(store)?.disconnect();
}

export function reconnectSyncStoreForTest(store: SyncStore): void {
  testSockets.get(store)?.connect();
}

export function getSyncSocketForTest(store: SyncStore): Socket | undefined {
  return testSockets.get(store);
}

export function deliverMessageForTest(store: SyncStore, msg: Record<string, unknown>): void {
  testMessageHandlers.get(store)?.(msg);
}

export function createSyncedTableStore(options: CreateSyncedStoreOptions): SyncStore {
  const {
    code,
    role,
    syncUrl,
    takeover = false,
    now = defaultNow,
    id = defaultId,
    onJoinError,
  } = options;
  const token = options.token;
  let activeModule = options.module;
  let activeRules = options.rules;
  let game: GameId = activeModule.id;

  const resolveModule = (gameId: GameId): void => {
    if (activeModule.id === gameId) {
      game = gameId;
      return;
    }
    const entry = getGame(gameId);
    if (!entry?.module) return;
    activeModule = entry.module;
    activeRules = entry.module.defaultRules;
    game = gameId;
  };

  const listeners = new Set<Listener>();
  const events: TableEvent[] = [];
  let latestSeq = 0;
  let joined = false;
  let readOnly = false;
  let rejectReason: string | null = null;
  let connectionState: ConnectionState = "reconnecting";
  let presence: SyncPresence = { dealers: 0, displays: 0, players: [] };
  let playerId: string | null = null;
  let pendingPlayers: PendingPlayerEntry[] = [];
  const pending = new Map<string, PendingEmit>();
  let offlineTimer: ReturnType<typeof setTimeout> | null = null;
  let flushing = false;
  let liveInput: TableEvent | null = null;
  let virtualStatus: VirtualStatus | null = null;
  let virtualPending: VirtualPendingState | null = null;

  const notify = (): void => {
    for (const l of listeners) l();
  };

  const setConnectionState = (state: ConnectionState): void => {
    connectionState = state;
    notify();
  };

  const clearOfflineTimer = (): void => {
    if (offlineTimer) clearTimeout(offlineTimer);
    offlineTimer = null;
  };

  const scheduleOffline = (): void => {
    clearOfflineTimer();
    offlineTimer = setTimeout(() => {
      if (!joined) setConnectionState("offline");
    }, 10_000);
  };

  const persist = (): void => {
    void saveTableEvents(code, game, events);
  };

  const recomputeLatestSeq = (): void => {
    latestSeq = events.reduce((max, e) => Math.max(max, e.seq), 0);
  };

  const applyServerEvents = (incoming: TableEvent[], replace = false): void => {
    if (replace) {
      events.length = 0;
      latestSeq = 0;
    }
    for (const event of incoming) {
      if (event.seq <= latestSeq) continue;
      if (event.seq !== latestSeq + 1) {
        socket.emit("message", { op: "resync", sinceSeq: latestSeq });
        return;
      }
      events.push(event);
      latestSeq = event.seq;
    }
    persist();
    notify();
  };

  const applyIncomingEvent = (event: TableEvent): void => {
    if (event.seq <= latestSeq) return;
    if (event.seq !== latestSeq + 1) {
      socket.emit("message", { op: "resync", sinceSeq: latestSeq });
      return;
    }
    events.push(event);
    latestSeq = event.seq;
    persist();
    notify();
  };

  const rollbackPending = (clientId: string): void => {
    const p = pending.get(clientId);
    if (!p) return;
    events.splice(p.eventIndex, 1);
    pending.delete(clientId);
    for (const [cid, info] of pending) {
      if (info.eventIndex > p.eventIndex) {
        pending.set(cid, { ...info, eventIndex: info.eventIndex - 1 });
      }
    }
    recomputeLatestSeq();
    notify();
  };

  const applyOptimistic = (body: TableEventInput, clientId: string): void => {
    const event = { seq: latestSeq + 1, at: now(), ...body } as TableEvent;
    events.push(event);
    latestSeq = event.seq;
    pending.set(clientId, { clientId, eventIndex: events.length - 1 });
    notify();
  };

  const confirmPending = (clientId: string, seq: number): void => {
    const p = pending.get(clientId);
    if (!p) return;
    const event = events[p.eventIndex];
    if (event) {
      (event as { seq: number }).seq = seq;
      latestSeq = Math.max(latestSeq, seq);
    }
    pending.delete(clientId);
    persist();
    notify();
  };

  const isOnline = (): boolean => joined && connectionState === "connected" && !flushing;

  const sendPersistedEvent = async (body: TableEventInput): Promise<void> => {
    if (role === "display" || readOnly) return;
    if (role === "dealer" && readOnly) return;

    rejectReason = null;
    const clientId = newClientId();
    applyOptimistic(body, clientId);

    if (!isOnline()) {
      await enqueueOfflineEvent(code, { clientId, event: body });
      persist();
      return;
    }

    socket.emit("message", { op: "event", clientId, event: body });
  };

  const flushOfflineQueue = async (): Promise<void> => {
    if (role !== "dealer" || readOnly || flushing || !joined) return;
    flushing = true;
    try {
      let item = (await peekOfflineQueue(code))[0];
      while (item && joined && connectionState === "connected") {
        if (!pending.has(item.clientId)) {
          await shiftOfflineQueue(code);
          item = (await peekOfflineQueue(code))[0];
          continue;
        }

        socket.emit("message", {
          op: "event",
          clientId: item.clientId,
          event: item.event,
        });

        try {
          await waitUntil(() => !pending.has(item!.clientId), 5000);
        } catch {
          break;
        }

        if (pending.has(item.clientId)) break;

        await shiftOfflineQueue(code);
        item = (await peekOfflineQueue(code))[0];
      }
    } finally {
      flushing = false;
    }
  };

  const sendJoin = (takeoverJoin = false): void => {
    joined = false;
    const sinceSeq = events.reduce((max, e) => Math.max(max, e.seq), 0);
    const payload: Record<string, unknown> = {
      op: "join",
      code,
      role,
      sinceSeq,
    };
    if ((role === "dealer" || role === "player") && token) payload.token = token;
    if (takeoverJoin) payload.takeover = true;
    socket.emit("message", payload);
  };

  const handleJoined = (msg: Record<string, unknown>): void => {
    joined = true;
    readOnly = false;
    rejectReason = null;
    clearOfflineTimer();
    setConnectionState("connected");

    if (typeof msg.game === "string") resolveModule(msg.game as GameId);

    if (Array.isArray(msg.snapshot)) {
      applyServerEvents(msg.snapshot as TableEvent[], true);
    } else if (Array.isArray(msg.events)) {
      applyServerEvents(msg.events as TableEvent[]);
    }

    if (typeof msg.seq === "number") latestSeq = Math.max(latestSeq, msg.seq);

    if (typeof msg.playerId === "string") {
      playerId = msg.playerId;
    }

    if (Array.isArray(msg.pending)) {
      pendingPlayers = msg.pending
        .filter((p): p is PendingPlayerEntry => {
          return (
            typeof p === "object" && p !== null && typeof (p as PendingPlayerEntry).id === "string"
          );
        })
        .map((p) => ({ id: p.id, name: p.name, color: p.color }));
    }

    if (msg.live && typeof msg.live === "object") {
      liveInput = { seq: latestSeq + 1, at: now(), ...(msg.live as object) } as TableEvent;
    }

    if (msg.virtual && typeof msg.virtual === "object") {
      const v = msg.virtual as VirtualStatus;
      virtualStatus = {
        awaiting: v.awaiting,
        ...(v.turnPlayerId ? { turnPlayerId: v.turnPlayerId } : {}),
        ...(v.turnPrompt ? { turnPrompt: v.turnPrompt } : {}),
      };
    }

    persist();
    notify();
    void flushOfflineQueue();
  };

  // Connect only after the local log has loaded so the first join carries the
  // right sinceSeq and the server delta never lands on top of a later local merge.
  const socket: Socket = io(syncUrl, {
    path: "/ws",
    transports: ["websocket"],
    autoConnect: false,
  });

  socket.on("connect", () => {
    setConnectionState("reconnecting");
    clearOfflineTimer();
    sendJoin(takeover);
  });

  socket.on("disconnect", () => {
    joined = false;
    setConnectionState("reconnecting");
    scheduleOffline();
  });

  socket.io.on("reconnect_attempt", () => {
    setConnectionState("reconnecting");
    clearOfflineTimer();
  });

  const onSocketMessage = (msg: Record<string, unknown>): void => {
    if (!msg || typeof msg !== "object") return;

    if (msg.op === "joined") {
      handleJoined(msg);
      return;
    }

    if (msg.op === "error" && typeof msg.code === "string") {
      rejectReason = msg.code;
      joined = false;
      onJoinError?.(msg.code);
      notify();
      return;
    }

    if (msg.op === "event" && msg.event) {
      const event = msg.event as TableEvent;
      if (event.type === "VIRTUAL_PENDING") {
        virtualPending = { kind: event.kind, untilAt: event.untilAt };
        notify();
        return;
      }
      if (event.type === "LIVE_INPUT") {
        liveInput = event;
      }
      if (event.seq <= 0) {
        notify();
        return;
      }
      applyIncomingEvent(event);
      return;
    }

    if (msg.op === "virtualStatus") {
      virtualStatus = {
        awaiting: msg.awaiting as VirtualStatus["awaiting"],
        ...(typeof msg.turnPlayerId === "string" ? { turnPlayerId: msg.turnPlayerId } : {}),
        ...(typeof msg.turnPrompt === "string" ? { turnPrompt: msg.turnPrompt } : {}),
      };
      notify();
      return;
    }

    if (msg.op === "ack" && typeof msg.clientId === "string") {
      confirmPending(msg.clientId, msg.seq as number);
      return;
    }

    if (msg.op === "reject") {
      if (typeof msg.clientId === "string") {
        rollbackPending(msg.clientId);
      }
      rejectReason = String(msg.reason ?? "rejected");
      notify();
      return;
    }

    if (msg.op === "presence") {
      const rawPlayers = Array.isArray(msg.players) ? msg.players : [];
      presence = {
        dealers: Number(msg.dealers ?? 0),
        displays: Number(msg.displays ?? 0),
        players: rawPlayers
          .filter((p): p is { id: string; connected: boolean } => {
            return (
              typeof p === "object" && p !== null && typeof (p as { id?: unknown }).id === "string"
            );
          })
          .map((p) => ({ id: p.id, connected: Boolean(p.connected) })),
      };
      notify();
      return;
    }

    if (msg.op === "pending" && Array.isArray(msg.players)) {
      pendingPlayers = msg.players
        .filter((p): p is PendingPlayerEntry => {
          return (
            typeof p === "object" && p !== null && typeof (p as PendingPlayerEntry).id === "string"
          );
        })
        .map((p) => ({ id: p.id, name: p.name, color: p.color }));
      notify();
      return;
    }

    if (msg.op === "demoted") {
      readOnly = true;
      notify();
    }
  };

  socket.on("message", onSocketMessage);

  let destroyed = false;
  void loadTable(code)
    .then((stored) => {
      if (stored && stored.events.length > 0 && events.length === 0) {
        events.push(...stored.events);
        resolveModule(stored.game);
        recomputeLatestSeq();
        notify();
      }
    })
    .catch(() => undefined)
    .then(() => {
      if (!destroyed) socket.connect();
    });

  if (role === "dealer" && token) saveDealerToken(code, token);
  if (role === "player" && token) savePlayerToken(code, token);

  const getEventsForReplay = (): TableEvent[] => {
    const list = [...events];
    if (liveInput) list.push(liveInput);
    return list;
  };

  const getComposed = (): ComposedState<unknown> =>
    replay(getEventsForReplay(), activeModule, activeRules, { code, includeEphemeral: true });

  const getRules = (): unknown => {
    const composed = getComposed();
    return resolveEffectiveRules(rules, composed.platform.settings.rules);
  };

  const getTableMeta = () => {
    const composed = getComposed();
    return buildTableMeta(composed, events, activeModule, composed.module);
  };

  const emitLive = (body: TableEventInput): void => {
    if (role === "display" || readOnly) return;
    if (body.type === "LIVE_INPUT") {
      liveInput = { seq: latestSeq + 1, at: now(), ...body } as TableEvent;
      notify();
      if (joined && connectionState === "connected") {
        socket.emit("message", {
          op: "event",
          clientId: newClientId(),
          event: body,
        });
      }
      return;
    }
    void sendPersistedEvent(body);
  };

  const canUndoLastResult = (): { ok: boolean; reason?: string } => {
    const composed = getComposed();
    const results = (composed.module as { results?: { id: string }[] }).results;
    if (!Array.isArray(results) || results.length === 0) {
      return { ok: false, reason: "No result to undo." };
    }
    const last = results[results.length - 1]!;
    return canUndoResult(composed.platform, last.id);
  };

  const record = (result: unknown, opts: { quick: boolean }): void => {
    const composed = getComposed();
    const envelope = buildResultEnvelope(composed, result, {
      id: id(),
      now: now(),
      quick: opts.quick,
    });
    void sendPersistedEvent({ type: "RESULT_RECORDED", result: envelope });
  };

  const store: SyncStore = {
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
    emit: emitLive,
    record,
    canUndoLastResult,
    undoLastResult: () => {
      const check = canUndoLastResult();
      if (!check.ok) return;
      const composed = getComposed();
      const results = (composed.module as { results?: { id: string }[] }).results;
      if (!Array.isArray(results) || results.length === 0) return;
      void sendPersistedEvent({ type: "RESULT_UNDONE", resultId: results[results.length - 1]!.id });
    },
    editResult: (result) => {
      void sendPersistedEvent({ type: "RESULT_EDITED", result });
    },
    deleteResult: (resultId) => {
      void sendPersistedEvent({ type: "RESULT_DELETED", resultId });
    },
    startNewSeries: (label, opts) => {
      void sendPersistedEvent({
        type: "SERIES_STARTED",
        seriesId: id(),
        ...(label !== undefined ? { label } : {}),
        ...(opts?.auto ? { auto: true } : {}),
      });
    },
    endSession: () => {
      void sendPersistedEvent({ type: "SESSION_ENDED" });
    },
    importResults: (results) => {
      for (const data of results) record(data, { quick: true });
    },
    sendVirtual: (kind, payload) => {
      if (role === "display" || readOnly) return;
      const clientId = newClientId();
      socket.emit("message", {
        op: "virtual",
        kind,
        clientId,
        ...(payload !== undefined ? { payload } : {}),
      });
    },
    getVirtualStatus: () => virtualStatus,
    getVirtualPending: () => virtualPending,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getConnectionState: () => connectionState,
    getPresence: () => presence,
    isReadOnly: () => readOnly,
    getRejectReason: () => rejectReason,
    takeover: () => {
      readOnly = false;
      sendJoin(true);
    },
    destroy: () => {
      destroyed = true;
      clearOfflineTimer();
      socket.disconnect();
      listeners.clear();
    },
    getDealerToken: () => (role === "dealer" ? (token ?? null) : null),
    getPlayerId: () => playerId,
    getPendingPlayers: () => pendingPlayers,
    sendAdmit: (targetPlayerId, accept) => {
      if (role !== "dealer" || readOnly) return;
      socket.emit("message", { op: "admit", playerId: targetPlayerId, accept });
    },
  };

  testSockets.set(store, socket);
  testMessageHandlers.set(store, onSocketMessage);
  return store;
}

export function waitForSyncReady(store: SyncStore, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (store.getConnectionState() === "connected") {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      unsub();
      reject(new Error("sync join timeout"));
    }, timeoutMs);
    const unsub = store.subscribe(() => {
      const err = store.getRejectReason();
      if (err) {
        clearTimeout(timer);
        unsub();
        reject(new Error(err));
        return;
      }
      if (store.getConnectionState() === "connected") {
        clearTimeout(timer);
        unsub();
        resolve();
      }
    });
  });
}
