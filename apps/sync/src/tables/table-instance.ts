import {
  isPersistedEvent,
  replay,
  resolveEffectiveRules,
  type ComposedState,
  type TableEvent,
  type TableSettings,
} from "@casino-lord/core";
import type { UntypedModule } from "../modules.js";
import type { TableRow } from "../persistence/repository.js";

export interface PlayerPresenceEntry {
  id: string;
  connected: boolean;
}

export interface SocketPresence {
  dealers: number;
  displays: number;
  players: PlayerPresenceEntry[];
}

export class TableInstance {
  readonly code: string;
  readonly game: TableRow["game"];
  readonly dealerTokenHash: string;
  readonly createdAt: string;

  private readonly module: UntypedModule;
  private readonly rules: unknown;
  private readonly events: TableEvent[] = [];
  private readonly clientIdMap = new Map<string, number>();
  private lastLive: unknown | undefined;
  private activeDealerSocketId: string | null = null;
  private demotedSocketIds = new Set<string>();
  private dealerSockets = new Set<string>();
  private displaySockets = new Set<string>();
  private playerSockets = new Map<string, Set<string>>();
  private socketToPlayer = new Map<string, string>();
  private lastActivityAt: string;

  constructor(
    row: TableRow,
    module: UntypedModule,
    rules: unknown,
    loadedEvents: TableEvent[] = [],
    lastActivityAt?: string,
  ) {
    this.code = row.code;
    this.game = row.game;
    this.dealerTokenHash = row.dealerTokenHash;
    this.createdAt = row.createdAt;
    this.module = module;
    this.rules = rules;
    this.events.push(...loadedEvents);
    this.lastActivityAt = lastActivityAt ?? row.lastSeenAt;

    for (const event of loadedEvents) {
      if (event.type === "LIVE_INPUT") {
        this.lastLive = event.payload;
      }
    }
  }

  get persistedEvents(): readonly TableEvent[] {
    return this.events.filter(isPersistedEvent);
  }

  get allEvents(): readonly TableEvent[] {
    return this.events;
  }

  get latestSeq(): number {
    if (this.events.length === 0) {
      return 0;
    }
    return this.events[this.events.length - 1]!.seq;
  }

  get sessionEnded(): boolean {
    return this.events.some((e) => e.type === "SESSION_ENDED");
  }

  get live(): unknown | undefined {
    return this.lastLive;
  }

  get settings(): TableSettings {
    return this.getComposed().platform.settings;
  }

  getComposed(): ComposedState<unknown> {
    return replay(this.events, this.module, this.rules, {
      code: this.code,
      includeEphemeral: true,
    });
  }

  getEffectiveRules(): unknown {
    const composed = this.getComposed();
    return resolveEffectiveRules(this.rules, composed.platform.settings.rules);
  }

  touch(at: string): void {
    this.lastActivityAt = at;
  }

  getLastActivityAt(): string {
    return this.lastActivityAt;
  }

  activePlayerCount(): number {
    return this.getComposed().platform.players.filter(
      (p) => p.status === "active" || p.status === "away",
    ).length;
  }

  presence(): SocketPresence {
    const composed = this.getComposed();
    const logPlayerIds = new Set(
      composed.platform.players.filter((p) => p.status !== "removed").map((p) => p.id),
    );

    const entries: PlayerPresenceEntry[] = [];
    for (const id of logPlayerIds) {
      entries.push({
        id,
        connected: (this.playerSockets.get(id)?.size ?? 0) > 0,
      });
    }

    for (const [id, sockets] of this.playerSockets) {
      if (!logPlayerIds.has(id)) {
        entries.push({ id, connected: sockets.size > 0 });
      }
    }

    return {
      dealers: this.dealerSockets.size,
      displays: this.displaySockets.size,
      players: entries,
    };
  }

  hasConnectedSockets(): boolean {
    return (
      this.dealerSockets.size +
        this.displaySockets.size +
        [...this.playerSockets.values()].reduce((n, s) => n + s.size, 0) >
      0
    );
  }

  onJoin(
    role: "dealer" | "display" | "player",
    socketId: string,
    options?: { takeover?: boolean; playerId?: string },
  ): { status: "ok" | "DEALER_ACTIVE"; demotedSocketId?: string } {
    if (role === "display") {
      this.displaySockets.add(socketId);
      return { status: "ok" };
    }

    if (role === "player") {
      const playerId = options?.playerId;
      if (!playerId) {
        return { status: "ok" };
      }
      let sockets = this.playerSockets.get(playerId);
      if (!sockets) {
        sockets = new Set();
        this.playerSockets.set(playerId, sockets);
      }
      sockets.add(socketId);
      this.socketToPlayer.set(socketId, playerId);
      return { status: "ok" };
    }

    const takeover = options?.takeover;
    if (this.activeDealerSocketId !== null && this.activeDealerSocketId !== socketId && !takeover) {
      return { status: "DEALER_ACTIVE" };
    }

    let demotedSocketId: string | undefined;
    if (takeover && this.activeDealerSocketId !== null && this.activeDealerSocketId !== socketId) {
      demotedSocketId = this.activeDealerSocketId;
      this.demotedSocketIds.add(this.activeDealerSocketId);
    }

    this.dealerSockets.add(socketId);
    this.activeDealerSocketId = socketId;
    this.demotedSocketIds.delete(socketId);
    return { status: "ok", ...(demotedSocketId !== undefined ? { demotedSocketId } : {}) };
  }

  onLeave(role: "dealer" | "display" | "player", socketId: string): void {
    if (role === "display") {
      this.displaySockets.delete(socketId);
      return;
    }

    if (role === "player") {
      const playerId = this.socketToPlayer.get(socketId);
      this.socketToPlayer.delete(socketId);
      if (playerId) {
        const sockets = this.playerSockets.get(playerId);
        sockets?.delete(socketId);
        if (sockets?.size === 0) {
          this.playerSockets.delete(playerId);
        }
      }
      return;
    }

    this.dealerSockets.delete(socketId);
    if (this.activeDealerSocketId === socketId) {
      this.activeDealerSocketId = null;
    }
    this.demotedSocketIds.delete(socketId);
  }

  getPlayerSocketIds(playerId: string): string[] {
    return [...(this.playerSockets.get(playerId) ?? [])];
  }

  disconnectPlayerSockets(playerId: string): string[] {
    const socketIds = this.getPlayerSocketIds(playerId);
    for (const socketId of socketIds) {
      this.onLeave("player", socketId);
    }
    return socketIds;
  }

  isDemoted(socketId: string): boolean {
    return this.demotedSocketIds.has(socketId);
  }

  demoteSocket(socketId: string): void {
    this.demotedSocketIds.add(socketId);
  }

  appendEvent(
    body: Omit<TableEvent, "seq" | "at">,
    clientId: string,
    at: string,
  ): { kind: "duplicate"; seq: number } | { kind: "new"; event: TableEvent; persisted: boolean } {
    const existingSeq = this.clientIdMap.get(clientId);
    if (existingSeq !== undefined) {
      return { kind: "duplicate", seq: existingSeq };
    }

    const seq = this.latestSeq + 1;
    const event = { ...body, seq, at } as TableEvent;
    this.clientIdMap.set(clientId, seq);
    this.events.push(event);
    this.lastActivityAt = at;

    if (event.type === "LIVE_INPUT") {
      this.lastLive = event.payload;
    }

    return { kind: "new", event, persisted: isPersistedEvent(event) };
  }

  joinPayload(sinceSeq?: number): { snapshot?: TableEvent[]; events?: TableEvent[] } {
    const seq = this.latestSeq;
    if (sinceSeq === undefined || sinceSeq >= seq) {
      return { snapshot: [...this.events] };
    }

    const oldest = this.events[0]?.seq ?? 1;
    if (sinceSeq < oldest) {
      return { snapshot: [...this.events] };
    }

    const delta = this.events.filter((e) => e.seq > sinceSeq);
    if (delta.length === 0) {
      return { snapshot: [...this.events] };
    }

    return { events: delta };
  }
}
