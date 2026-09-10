import {
  getRoundSettlements,
  isValidPlayerColor,
  isValidTableCode,
  validatePlayerName,
  type GameId,
  type Player,
  type TableEvent,
  type TableEventType,
} from "@casino-lord/core";
import { savePlayerToken } from "../sync/player-token.js";
import { buildTableMeta } from "./meta.js";
import type { UntypedGameModule } from "./module-types.js";
import { validateSoloPlayerEvent } from "./solo-channel-validation.js";
import type {
  ConnectionState,
  PendingPlayerEntry,
  SyncPresence,
  SyncStore,
  VirtualPendingState,
  VirtualStatus,
} from "./sync-store-types.js";
import type { Listener, TableStore } from "./store.js";
import { replay, resolveEffectiveRules, type ComposedState } from "@casino-lord/core";

type TableEventInput = { type: TableEventType } & Record<string, unknown>;

const CHANNEL_PREFIX = "casino-lord:solo:";
const TOKEN_MAP_KEY = "casino-lord:solo-player-tokens:";

export type SoloChannelRole = "dealer" | "player" | "display";

export type SoloChannelMessage =
  | { op: "hello"; role: SoloChannelRole; clientId: string }
  | { op: "snapshot"; events: TableEvent[] }
  | { op: "join"; clientId: string; name: string; color: string }
  | { op: "rejoin"; clientId: string; playerToken: string }
  | { op: "joinAck"; clientId: string; playerId: string; playerToken: string }
  | { op: "joinReject"; clientId: string; reason: string }
  | { op: "playerEvent"; clientId: string; playerId: string; event: TableEventInput }
  | { op: "event"; event: TableEvent }
  | { op: "ack"; clientId: string; seq: number }
  | { op: "reject"; clientId: string; reason: string };

export function isSoloBroadcastChannelAvailable(): boolean {
  return typeof BroadcastChannel !== "undefined";
}

export function soloChannelName(code: string): string {
  return `${CHANNEL_PREFIX}${code}`;
}

export function soloLocalUrl(path: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://127.0.0.1:3000";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultId(): string {
  return crypto.randomUUID();
}

function sessionStorageSafe(): Storage | null {
  return typeof sessionStorage !== "undefined" ? sessionStorage : null;
}

function loadTokenMap(code: string): Record<string, string> {
  const raw = sessionStorageSafe()?.getItem(`${TOKEN_MAP_KEY}${code}`);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function saveTokenMap(code: string, map: Record<string, string>): void {
  sessionStorageSafe()?.setItem(`${TOKEN_MAP_KEY}${code}`, JSON.stringify(map));
}

function postMessage(channel: BroadcastChannel, msg: SoloChannelMessage): void {
  channel.postMessage(msg);
}

function latestSeq(events: readonly TableEvent[]): number {
  return events.reduce((max, e) => Math.max(max, e.seq), 0);
}

function sessionEnded(events: readonly TableEvent[]): boolean {
  return events.some((e) => e.type === "SESSION_ENDED");
}

export interface AttachSoloBroadcastChannelOptions {
  module: UntypedGameModule;
  now?: () => string;
  id?: () => string;
}

export interface SoloBroadcastChannelHandle {
  detach(): void;
}

export function attachSoloBroadcastChannel(
  store: TableStore,
  options: AttachSoloBroadcastChannelOptions,
): SoloBroadcastChannelHandle {
  const { module } = options;
  const now = options.now ?? defaultNow;
  const idGen = options.id ?? defaultId;
  const channel = new BroadcastChannel(soloChannelName(store.code));
  let lastBroadcastSeq = latestSeq(store.events);
  let detached = false;

  const broadcastNewEvents = (): void => {
    const events = store.events;
    for (const event of events) {
      if (event.seq > lastBroadcastSeq) {
        postMessage(channel, { op: "event", event });
        lastBroadcastSeq = event.seq;
      }
    }
  };

  const sendSnapshot = (clientId?: string): void => {
    void clientId;
    postMessage(channel, { op: "snapshot", events: [...store.events] });
    lastBroadcastSeq = latestSeq(store.events);
  };

  const handleJoin = (clientId: string, name: string, color: string): void => {
    const composed = store.getComposed();
    const participation = composed.platform.participation;

    if (participation.playerMode !== "on") {
      postMessage(channel, { op: "joinReject", clientId, reason: "PLAYERS_DISABLED" });
      return;
    }

    if (sessionEnded(store.events)) {
      postMessage(channel, { op: "joinReject", clientId, reason: "SESSION_ENDED" });
      return;
    }

    if (!composed.platform.settings.players.joiningOpen) {
      postMessage(channel, { op: "joinReject", clientId, reason: "JOINING_CLOSED" });
      return;
    }

    const nameResult = validatePlayerName(name);
    if (!nameResult.ok) {
      postMessage(channel, { op: "joinReject", clientId, reason: "INVALID_NAME" });
      return;
    }

    if (!isValidPlayerColor(color)) {
      postMessage(channel, { op: "joinReject", clientId, reason: "INVALID_COLOR" });
      return;
    }

    const maxPlayers = composed.platform.settings.players.maxPlayers;
    const activeCount = composed.platform.players.filter((p) => p.status !== "removed").length;
    if (activeCount >= maxPlayers) {
      postMessage(channel, { op: "joinReject", clientId, reason: "TABLE_FULL" });
      return;
    }

    const playerId = idGen();
    const playerToken = idGen();
    const player: Player = {
      id: playerId,
      name: nameResult.name,
      color,
      status: "active",
      joinedAt: now(),
    };

    store.emit({ type: "PLAYER_JOINED", player });

    const afterJoin = store.getComposed();
    if (
      afterJoin.platform.participation.bank === "house" &&
      afterJoin.platform.settings.bank.autoBuyIn
    ) {
      store.emit({
        type: "BANK_ISSUED",
        playerId,
        amount: afterJoin.platform.settings.bank.defaultBuyIn,
        reason: "buyin",
      });
    }

    const tokenMap = loadTokenMap(store.code);
    tokenMap[playerToken] = playerId;
    saveTokenMap(store.code, tokenMap);

    postMessage(channel, { op: "joinAck", clientId, playerId, playerToken });
    broadcastNewEvents();
  };

  const handleRejoin = (clientId: string, playerToken: string): void => {
    const tokenMap = loadTokenMap(store.code);
    const playerId = tokenMap[playerToken];
    if (!playerId) {
      postMessage(channel, { op: "joinReject", clientId, reason: "BAD_TOKEN" });
      return;
    }

    const composed = store.getComposed();
    const player = composed.platform.players.find(
      (p) => p.id === playerId && p.status !== "removed",
    );
    if (!player) {
      postMessage(channel, { op: "joinReject", clientId, reason: "BAD_TOKEN" });
      return;
    }

    postMessage(channel, { op: "joinAck", clientId, playerId, playerToken });
    sendSnapshot(clientId);
  };

  const handlePlayerEvent = (clientId: string, playerId: string, event: TableEventInput): void => {
    const validation = validateSoloPlayerEvent(event, module, playerId);
    if (!validation.ok) {
      if (validation.ownershipViolation) {
        return;
      }
      postMessage(channel, { op: "reject", clientId, reason: validation.reason });
      return;
    }

    store.emit(validation.event);
    broadcastNewEvents();
    const seq = latestSeq(store.events);
    postMessage(channel, { op: "ack", clientId, seq });
  };

  const onMessage = (ev: MessageEvent<SoloChannelMessage>): void => {
    if (detached) return;
    const msg = ev.data;
    if (!msg || typeof msg !== "object" || !("op" in msg)) return;

    switch (msg.op) {
      case "hello":
        sendSnapshot(msg.clientId);
        break;
      case "join":
        handleJoin(msg.clientId, msg.name, msg.color);
        break;
      case "rejoin":
        handleRejoin(msg.clientId, msg.playerToken);
        break;
      case "playerEvent":
        handlePlayerEvent(msg.clientId, msg.playerId, msg.event);
        break;
      default:
        break;
    }
  };

  channel.addEventListener("message", onMessage);
  const unsub = store.subscribe(broadcastNewEvents);

  return {
    detach() {
      if (detached) return;
      detached = true;
      unsub();
      channel.removeEventListener("message", onMessage);
      channel.close();
    },
  };
}

export interface CreateSoloPlayerStoreOptions {
  code: string;
  game: GameId;
  module: UntypedGameModule;
  rules: unknown;
  playerId: string;
  playerToken: string;
  clientId?: string;
  now?: () => string;
}

export function createSoloPlayerStore(options: CreateSoloPlayerStoreOptions): SyncStore {
  const { code, game, module, rules, playerId, playerToken, clientId = defaultId() } = options;
  const listeners = new Set<Listener>();
  const events: TableEvent[] = [];
  let latestEventSeq = 0;
  const channel = new BroadcastChannel(soloChannelName(code));
  let destroyed = false;

  const notify = (): void => {
    for (const l of listeners) l();
  };

  const applySnapshot = (snapshot: TableEvent[]): void => {
    events.length = 0;
    events.push(...snapshot);
    latestEventSeq = latestSeq(events);
    notify();
  };

  const applyEvent = (event: TableEvent): void => {
    if (event.seq <= latestEventSeq) return;
    events.push(event);
    latestEventSeq = event.seq;
    notify();
  };

  const onMessage = (ev: MessageEvent<SoloChannelMessage>): void => {
    if (destroyed) return;
    const msg = ev.data;
    if (!msg || typeof msg !== "object" || !("op" in msg)) return;

    switch (msg.op) {
      case "snapshot":
        applySnapshot(msg.events);
        break;
      case "event":
        applyEvent(msg.event);
        break;
      default:
        break;
    }
  };

  channel.addEventListener("message", onMessage);
  postMessage(channel, { op: "hello", role: "player", clientId });

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

  const emitLive = (body: TableEventInput): void => {
    if (destroyed) return;
    postMessage(channel, {
      op: "playerEvent",
      clientId,
      playerId,
      event: body,
    });
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
    record: () => undefined,
    canUndoLastResult: () => ({ ok: false, reason: "read-only" }),
    undoLastResult: () => undefined,
    editResult: () => undefined,
    deleteResult: () => undefined,
    startNewSeries: () => undefined,
    endSession: () => undefined,
    importResults: () => undefined,
    sendVirtual: () => undefined,
    getVirtualStatus: (): VirtualStatus | null => null,
    getVirtualPending: (): VirtualPendingState | null => null,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getConnectionState: (): ConnectionState => "connected",
    getPresence: (): SyncPresence => ({
      dealers: 1,
      displays: 0,
      players: [{ id: playerId, connected: true }],
    }),
    isReadOnly: () => false,
    getRejectReason: () => null,
    takeover: () => undefined,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      channel.removeEventListener("message", onMessage);
      channel.close();
      listeners.clear();
    },
    getDealerToken: () => null,
    getPlayerId: () => playerId,
    getPendingPlayers: (): PendingPlayerEntry[] => [],
    sendAdmit: () => undefined,
  };

  savePlayerToken(code, playerToken);
  void playerToken;

  return store;
}

export interface CreateSoloDisplayStoreOptions {
  code: string;
  game: GameId;
  module: UntypedGameModule;
  rules: unknown;
  clientId?: string;
}

export function createSoloDisplayStore(options: CreateSoloDisplayStoreOptions): TableStore {
  const { code, game, module, rules, clientId = defaultId() } = options;
  const listeners = new Set<Listener>();
  const events: TableEvent[] = [];
  let latestEventSeq = 0;
  const channel = new BroadcastChannel(soloChannelName(code));
  let destroyed = false;

  const notify = (): void => {
    for (const l of listeners) l();
  };

  const applySnapshot = (snapshot: TableEvent[]): void => {
    events.length = 0;
    events.push(...snapshot);
    latestEventSeq = latestSeq(events);
    notify();
  };

  const applyEvent = (event: TableEvent): void => {
    if (event.seq <= latestEventSeq) return;
    events.push(event);
    latestEventSeq = event.seq;
    notify();
  };

  const onMessage = (ev: MessageEvent<SoloChannelMessage>): void => {
    if (destroyed) return;
    const msg = ev.data;
    if (!msg || typeof msg !== "object" || !("op" in msg)) return;

    switch (msg.op) {
      case "snapshot":
        applySnapshot(msg.events);
        break;
      case "event":
        applyEvent(msg.event);
        break;
      default:
        break;
    }
  };

  channel.addEventListener("message", onMessage);
  postMessage(channel, { op: "hello", role: "display", clientId });

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

  const noop = (): void => undefined;

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
    emit: noop,
    record: noop,
    canUndoLastResult: () => ({ ok: false, reason: "read-only" }),
    undoLastResult: noop,
    editResult: noop,
    deleteResult: noop,
    startNewSeries: noop,
    endSession: noop,
    importResults: noop,
    sendVirtual: noop,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      channel.removeEventListener("message", onMessage);
      channel.close();
      listeners.clear();
    },
  } as TableStore & { destroy(): void };
}

export interface JoinSoloPlayerOptions {
  code: string;
  name: string;
  color: string;
  clientId?: string;
  timeoutMs?: number;
}

export type JoinSoloPlayerResult =
  { ok: true; playerId: string; playerToken: string } | { ok: false; reason: string };

export function joinSoloPlayer(options: JoinSoloPlayerOptions): Promise<JoinSoloPlayerResult> {
  const { code, name, color, clientId = defaultId(), timeoutMs = 5000 } = options;

  if (!isValidTableCode(code)) {
    return Promise.resolve({ ok: false, reason: "INVALID_CODE" });
  }

  if (!isSoloBroadcastChannelAvailable()) {
    return Promise.resolve({ ok: false, reason: "NO_CHANNEL" });
  }

  return new Promise((resolve) => {
    const channel = new BroadcastChannel(soloChannelName(code));
    let settled = false;

    const finish = (result: JoinSoloPlayerResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel.removeEventListener("message", onMessage);
      channel.close();
      resolve(result);
    };

    const timer = setTimeout(() => finish({ ok: false, reason: "TIMEOUT" }), timeoutMs);

    const onMessage = (ev: MessageEvent<SoloChannelMessage>): void => {
      const msg = ev.data;
      if (!msg || typeof msg !== "object" || !("op" in msg)) return;

      if (msg.op === "joinAck" && msg.clientId === clientId) {
        savePlayerToken(code, msg.playerToken);
        finish({ ok: true, playerId: msg.playerId, playerToken: msg.playerToken });
      } else if (msg.op === "joinReject" && msg.clientId === clientId) {
        finish({ ok: false, reason: msg.reason });
      }
    };

    channel.addEventListener("message", onMessage);
    postMessage(channel, { op: "hello", role: "player", clientId });
    postMessage(channel, { op: "join", clientId, name, color });
  });
}

export function rejoinSoloPlayer(options: {
  code: string;
  playerToken: string;
  clientId?: string;
  timeoutMs?: number;
}): Promise<JoinSoloPlayerResult> {
  const { code, playerToken, clientId = defaultId(), timeoutMs = 5000 } = options;

  if (!isValidTableCode(code)) {
    return Promise.resolve({ ok: false, reason: "INVALID_CODE" });
  }

  if (!isSoloBroadcastChannelAvailable()) {
    return Promise.resolve({ ok: false, reason: "NO_CHANNEL" });
  }

  return new Promise((resolve) => {
    const channel = new BroadcastChannel(soloChannelName(code));
    let settled = false;

    const finish = (result: JoinSoloPlayerResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel.removeEventListener("message", onMessage);
      channel.close();
      resolve(result);
    };

    const timer = setTimeout(() => finish({ ok: false, reason: "TIMEOUT" }), timeoutMs);

    const onMessage = (ev: MessageEvent<SoloChannelMessage>): void => {
      const msg = ev.data;
      if (!msg || typeof msg !== "object" || !("op" in msg)) return;

      if (msg.op === "joinAck" && msg.clientId === clientId) {
        savePlayerToken(code, msg.playerToken);
        finish({ ok: true, playerId: msg.playerId, playerToken: msg.playerToken });
      } else if (msg.op === "joinReject" && msg.clientId === clientId) {
        finish({ ok: false, reason: msg.reason });
      }
    };

    channel.addEventListener("message", onMessage);
    postMessage(channel, { op: "hello", role: "player", clientId });
    postMessage(channel, { op: "rejoin", clientId, playerToken });
  });
}

export function waitForSoloSnapshot(
  store: TableStore | SyncStore,
  timeoutMs = 5000,
): Promise<void> {
  if (store.events.length > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error("timeout waiting for solo snapshot"));
    }, timeoutMs);

    const unsub = store.subscribe(() => {
      if (store.events.length > 0) {
        clearTimeout(timer);
        unsub();
        resolve();
      }
    });
  });
}

export function getPlayerSettlementProfit(
  store: TableStore | SyncStore,
  playerId: string,
  roundId: string,
): number {
  const composed = store.getComposed();
  const settlements = getRoundSettlements(composed.platform, roundId);
  const betById = new Map(composed.platform.bets.map((b) => [b.id, b]));
  let profit = 0;
  for (const s of settlements) {
    const bet = betById.get(s.betId);
    if (bet?.playerId === playerId) {
      profit += s.profit;
    }
  }
  return profit;
}
