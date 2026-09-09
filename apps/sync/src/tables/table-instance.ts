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

export interface SocketPresence {
  dealers: number;
  displays: number;
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

  presence(): SocketPresence {
    return { dealers: this.dealerSockets.size, displays: this.displaySockets.size };
  }

  hasConnectedSockets(): boolean {
    return this.dealerSockets.size + this.displaySockets.size > 0;
  }

  onJoin(
    role: "dealer" | "display",
    socketId: string,
    takeover?: boolean,
  ): { status: "ok" | "DEALER_ACTIVE"; demotedSocketId?: string } {
    if (role === "display") {
      this.displaySockets.add(socketId);
      return { status: "ok" };
    }

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

  onLeave(role: "dealer" | "display", socketId: string): void {
    if (role === "display") {
      this.displaySockets.delete(socketId);
      return;
    }

    this.dealerSockets.delete(socketId);
    if (this.activeDealerSocketId === socketId) {
      this.activeDealerSocketId = null;
    }
    this.demotedSocketIds.delete(socketId);
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
