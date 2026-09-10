import { normalizeTableCode, type TableEvent } from "@casino-lord/core";
import type { Server, Socket } from "socket.io";
import type { Config } from "../config.js";
import { getModule } from "../modules.js";
import {
  createRateLimiter,
  DEALER_EVENT_LIMIT,
  DEALER_EVENT_WINDOW_MS,
  PLAYER_EVENT_LIMIT,
  PLAYER_EVENT_WINDOW_MS,
  VIRTUAL_TRIGGER_LIMIT,
  VIRTUAL_TRIGGER_WINDOW_MS,
} from "../rate-limit.js";
import { validateInboundEvent } from "../schemas/event-input.js";
import {
  admitMessageSchema,
  eventMessageSchema,
  joinMessageSchema,
  pingMessageSchema,
  resyncMessageSchema,
  virtualMessageSchema,
} from "../schemas/messages.js";
import type { TableInstance } from "../tables/table-instance.js";
import type { TableRegistry } from "../tables/registry.js";
import { verifyToken } from "../tables/token.js";
import {
  buildVirtualStatus,
  executeVirtualStep,
  resolveVirtualRequest,
} from "../tables/virtual-executor.js";
import { defaultActionForModule } from "../tables/virtual-dealer.js";

interface SocketState {
  code?: string;
  role?: "dealer" | "display" | "player";
  playerId?: string;
  joined?: boolean;
}

export interface WsHandlerOptions {
  registry: TableRegistry;
  config: Config;
  rateLimiter?: ReturnType<typeof createRateLimiter>;
}

function room(code: string): string {
  return `table:${code}`;
}

function sendPresence(io: Server, table: TableInstance, code: string): void {
  const p = table.presence();
  io.to(room(code)).emit("message", {
    op: "presence",
    dealers: p.dealers,
    displays: p.displays,
    players: p.players,
  });
}

function sendPendingToDealers(io: Server, registry: TableRegistry, code: string): void {
  io.to(room(code)).emit("message", {
    op: "pending",
    players: registry.pendingPayload(code),
  });
}

export function notifyPendingPlayers(io: Server, registry: TableRegistry, code: string): void {
  sendPendingToDealers(io, registry, code);
}

export function broadcastEvent(io: Server, code: string, event: TableEvent): void {
  io.to(room(code)).emit("message", { op: "event", event });
}

export function disconnectSocketIds(io: Server, socketIds: string[]): void {
  for (const socketId of socketIds) {
    io.sockets.sockets.get(socketId)?.disconnect(true);
  }
}

function joinedPayload(
  table: TableInstance,
  role: "dealer" | "display" | "player",
  sinceSeq?: number,
  playerId?: string,
  pendingPlayers?: Array<{ id: string; name: string; color: string }>,
  registry?: TableRegistry,
) {
  const composed = table.getComposed();
  const delta = table.joinPayload(sinceSeq);
  const payload: Record<string, unknown> = {
    op: "joined",
    role,
    game: table.game,
    participation: composed.platform.participation,
    seq: table.latestSeq,
  };

  if (playerId) {
    payload.playerId = playerId;
  }

  if (delta.snapshot) {
    payload.snapshot = delta.snapshot;
  } else if (delta.events) {
    payload.events = delta.events;
  }

  if (table.live !== undefined) {
    payload.live = table.live;
  }

  if (pendingPlayers !== undefined) {
    payload.pending = pendingPlayers;
  }

  if (registry && composed.platform.participation.outcomeSource === "virtual") {
    const virtualDealer = registry.getVirtualDealer(table.code);
    const module = getModule(table.game);
    if (virtualDealer && module) {
      payload.virtual = buildVirtualStatus(table, module, virtualDealer);
    }
  }

  return payload;
}

export function attachWebSocket(io: Server, options: WsHandlerOptions): void {
  const { registry, config } = options;
  const rateLimiter = options.rateLimiter ?? createRateLimiter();

  io.on("connection", (socket: Socket) => {
    const state: SocketState = {};

    socket.on("message", (raw: unknown) => {
      if (!raw || typeof raw !== "object") {
        return;
      }

      const msg = raw as Record<string, unknown>;

      if (msg.op === "ping") {
        const parsed = pingMessageSchema.safeParse(msg);
        if (parsed.success) {
          socket.emit("message", { op: "pong" });
        }
        return;
      }

      if (msg.op === "join") {
        handleJoin(socket, msg, state);
        return;
      }

      if (msg.op === "resync") {
        handleResync(socket, msg, state);
        return;
      }

      if (msg.op === "admit") {
        handleAdmit(socket, msg, state);
        return;
      }

      if (msg.op === "virtual") {
        handleVirtual(socket, msg, state, rateLimiter);
        return;
      }

      if (msg.op === "event") {
        handleEvent(socket, msg, state, rateLimiter);
      }
    });

    socket.on("disconnect", () => {
      if (!state.code || !state.role || !state.joined) {
        return;
      }
      const table = registry.get(state.code);
      if (!table) {
        return;
      }
      table.onLeave(state.role, socket.id);
      sendPresence(io, table, state.code);
    });

    function handleJoin(socket: Socket, msg: Record<string, unknown>, st: SocketState): void {
      const parsed = joinMessageSchema.safeParse(msg);
      if (!parsed.success) {
        return;
      }

      const { code: rawCode, role, token, sinceSeq, takeover } = parsed.data;
      const code = normalizeTableCode(rawCode);
      const table = registry.get(code);
      if (!table) {
        socket.emit("message", { op: "error", code: "NOT_FOUND" });
        return;
      }

      if (table.sessionEnded && role === "dealer") {
        socket.emit("message", { op: "error", code: "SESSION_ENDED" });
        return;
      }

      const module = getModule(table.game);
      if (!module) {
        socket.emit("message", { op: "error", code: "UNSUPPORTED_GAME" });
        return;
      }

      if (role === "player") {
        if (!config.enablePlayerMode) {
          socket.emit("message", { op: "error", code: "PLAYERS_DISABLED" });
          return;
        }

        const composed = table.getComposed();
        if (composed.platform.participation.playerMode !== "on") {
          socket.emit("message", { op: "error", code: "PLAYERS_DISABLED" });
          return;
        }

        if (!token) {
          socket.emit("message", { op: "error", code: "BAD_TOKEN" });
          return;
        }

        const playerRow = registry.verifyPlayerToken(code, token);
        if (!playerRow) {
          socket.emit("message", { op: "error", code: "BAD_TOKEN" });
          return;
        }

        table.onJoin("player", socket.id, { playerId: playerRow.playerId });
        void socket.join(room(code));
        st.code = code;
        st.role = "player";
        st.playerId = playerRow.playerId;
        st.joined = true;
        socket.data = st;

        socket.emit(
          "message",
          joinedPayload(table, "player", sinceSeq, playerRow.playerId, undefined, registry),
        );
        sendPresence(io, table, code);
        return;
      }

      if (role === "dealer") {
        if (table.sessionEnded) {
          socket.emit("message", { op: "error", code: "SESSION_ENDED" });
          return;
        }
        if (!token) {
          socket.emit("message", { op: "error", code: "BAD_TOKEN" });
          return;
        }
        if (!verifyToken(token, table.dealerTokenHash)) {
          socket.emit("message", { op: "error", code: "BAD_TOKEN" });
          return;
        }

        const joinResult = table.onJoin(
          "dealer",
          socket.id,
          takeover !== undefined ? { takeover } : {},
        );
        if (joinResult.status === "DEALER_ACTIVE") {
          socket.emit("message", { op: "error", code: "DEALER_ACTIVE" });
          return;
        }

        if (joinResult.demotedSocketId) {
          io.sockets.sockets.get(joinResult.demotedSocketId)?.emit("message", { op: "demoted" });
        }

        void socket.join(room(code));
        st.code = code;
        st.role = "dealer";
        st.joined = true;
        socket.data = st;

        socket.emit(
          "message",
          joinedPayload(
            table,
            "dealer",
            sinceSeq,
            undefined,
            registry.pendingPayload(code),
            registry,
          ),
        );
        sendPresence(io, table, code);
        return;
      }

      table.onJoin("display", socket.id);
      void socket.join(room(code));
      st.code = code;
      st.role = "display";
      st.joined = true;
      socket.data = st;

      socket.emit(
        "message",
        joinedPayload(table, "display", sinceSeq, undefined, undefined, registry),
      );
      sendPresence(io, table, code);
    }

    function handleAdmit(socket: Socket, msg: Record<string, unknown>, st: SocketState): void {
      const parsed = admitMessageSchema.safeParse(msg);
      if (!parsed.success || !st.code || st.role !== "dealer" || !st.joined) {
        return;
      }

      if (tableIsDemoted(st, socket)) {
        return;
      }

      const table = registry.get(st.code);
      if (!table) {
        return;
      }

      const { playerId, accept } = parsed.data;
      const result = registry.admitPlayer(st.code, playerId, accept);

      if (!result.ok) {
        return;
      }

      if (result.declined) {
        const socketIds = table.getPlayerSocketIds(playerId);
        for (const sid of socketIds) {
          io.sockets.sockets.get(sid)?.emit("message", { op: "reject", reason: "DECLINED" });
        }
        table.disconnectPlayerSockets(playerId);
      } else if (result.event) {
        io.to(room(st.code)).emit("message", { op: "event", event: result.event });
      }

      io.to(room(st.code)).emit("message", {
        op: "pending",
        players: registry.pendingPayload(st.code),
      });
      sendPresence(io, table, st.code);
    }

    function handleResync(socket: Socket, msg: Record<string, unknown>, st: SocketState): void {
      const parsed = resyncMessageSchema.safeParse(msg);
      if (!parsed.success || !st.code || !st.role || !st.joined) {
        return;
      }

      const table = registry.get(st.code);
      if (!table) {
        socket.emit("message", { op: "error", code: "NOT_FOUND" });
        return;
      }

      socket.emit(
        "message",
        joinedPayload(table, st.role, parsed.data.sinceSeq, st.playerId, undefined, registry),
      );
    }

    function handleEvent(
      socket: Socket,
      msg: Record<string, unknown>,
      st: SocketState,
      limiter: ReturnType<typeof createRateLimiter>,
    ): void {
      const parsed = eventMessageSchema.safeParse(msg);
      if (!parsed.success || !st.code || !st.role || !st.joined) {
        return;
      }

      if (st.role === "display") {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "not authorized",
        });
        return;
      }

      if (st.role === "dealer" && tableIsDemoted(st, socket)) {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "demoted",
        });
        return;
      }

      const table = registry.get(st.code);
      if (!table) {
        return;
      }

      if (table.sessionEnded) {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "SESSION_ENDED",
        });
        return;
      }

      const limitKey = st.role === "player" ? `player:${socket.id}` : `dealer:${socket.id}`;
      const limit = st.role === "player" ? PLAYER_EVENT_LIMIT : DEALER_EVENT_LIMIT;
      const window = st.role === "player" ? PLAYER_EVENT_WINDOW_MS : DEALER_EVENT_WINDOW_MS;

      if (!limiter.tryConsume(limitKey, limit, window)) {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "rate limit exceeded",
        });
        return;
      }

      const module = getModule(table.game);
      if (!module) {
        return;
      }

      const composed = table.getComposed();
      const rawEvent = parsed.data.event as {
        type?: string;
        commit?: string;
        label?: string;
        auto?: boolean;
      };

      if (composed.platform.participation.outcomeSource === "virtual") {
        const eventType = rawEvent.type;
        if (
          st.role === "dealer" &&
          (eventType === "RESULT_RECORDED" || eventType === "LIVE_INPUT")
        ) {
          socket.emit("message", {
            op: "reject",
            clientId: parsed.data.clientId,
            reason: "MIXED_SERIES",
          });
          return;
        }

        if (st.role === "dealer" && eventType === "SERIES_STARTED") {
          if ("commit" in rawEvent && rawEvent.commit !== undefined) {
            socket.emit("message", {
              op: "reject",
              clientId: parsed.data.clientId,
              reason: "client commit not allowed",
            });
            return;
          }

          const rotated = registry.dealerRotateVirtualSeries(st.code, {
            ...(rawEvent.label !== undefined ? { label: rawEvent.label } : {}),
            ...(rawEvent.auto === true ? { auto: true } : {}),
          });
          if (!rotated) {
            socket.emit("message", {
              op: "reject",
              clientId: parsed.data.clientId,
              reason: "no virtual dealer",
            });
            return;
          }

          const at = new Date().toISOString();
          let lastSeq: number | undefined;
          for (let i = 0; i < rotated.length; i++) {
            const result = table.appendEvent(rotated[i]!, `${parsed.data.clientId}:${i}`, at);
            if (result.kind === "duplicate") {
              lastSeq = result.seq;
              continue;
            }
            registry.persistEvent(st.code, result.event);
            if (result.event.type === "SERIES_STARTED") {
              registry.persistVirtualDealer(st.code);
            }
            io.to(room(st.code)).emit("message", { op: "event", event: result.event });
            lastSeq = result.event.seq;
          }

          if (lastSeq !== undefined) {
            socket.emit("message", {
              op: "ack",
              clientId: parsed.data.clientId,
              seq: lastSeq,
            });
          }
          return;
        }

        if (st.role === "dealer" && eventType === "SESSION_ENDED") {
          const virtualDealer = registry.getVirtualDealer(st.code);
          if (!virtualDealer) {
            socket.emit("message", {
              op: "reject",
              clientId: parsed.data.clientId,
              reason: "no virtual dealer",
            });
            return;
          }

          const sessionValidation = validateInboundEvent(
            parsed.data.event,
            st.role,
            module,
            st.playerId,
          );
          if (!sessionValidation.ok) {
            socket.emit("message", {
              op: "reject",
              clientId: parsed.data.clientId,
              reason: sessionValidation.reason,
            });
            return;
          }

          const at = new Date().toISOString();
          const toAppend = [virtualDealer.endSeriesEvent(), sessionValidation.event];
          let lastSeq: number | undefined;
          for (let i = 0; i < toAppend.length; i++) {
            const result = table.appendEvent(toAppend[i]!, `${parsed.data.clientId}:${i}`, at);
            if (result.kind === "duplicate") {
              lastSeq = result.seq;
              continue;
            }
            registry.persistEvent(st.code, result.event);
            io.to(room(st.code)).emit("message", { op: "event", event: result.event });
            lastSeq = result.event.seq;
          }

          if (lastSeq !== undefined) {
            socket.emit("message", {
              op: "ack",
              clientId: parsed.data.clientId,
              seq: lastSeq,
            });
          }
          return;
        }
      }

      const validation = validateInboundEvent(parsed.data.event, st.role, module, st.playerId);
      if (!validation.ok) {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: validation.reason,
        });
        return;
      }

      const at = new Date().toISOString();
      const result = table.appendEvent(validation.event, parsed.data.clientId, at);

      if (result.kind === "duplicate") {
        socket.emit("message", {
          op: "ack",
          clientId: parsed.data.clientId,
          seq: result.seq,
        });
        return;
      }

      registry.persistEvent(st.code, result.event);

      socket.emit("message", {
        op: "ack",
        clientId: parsed.data.clientId,
        seq: result.event.seq,
      });

      io.to(room(st.code)).emit("message", {
        op: "event",
        event: result.event,
      });

      if (
        result.event.type === "BETS_CLOSED" &&
        composed.platform.participation.outcomeSource === "virtual" &&
        table.settings.virtual.autoTrigger
      ) {
        scheduleAutoTrigger(st.code, table);
      }
    }

    function scheduleAutoTrigger(code: string, table: TableInstance): void {
      const virtualDealer = registry.getVirtualDealer(code);
      const module = getModule(table.game);
      if (!virtualDealer || !module?.virtual) {
        return;
      }
      if (virtualDealer.dealing || virtualDealer.awaiting === "action") {
        return;
      }
      const delayMs = table.settings.betting.autoOpenDelayMs;
      setTimeout(() => {
        const liveTable = registry.get(code);
        const liveDealer = registry.getVirtualDealer(code);
        const liveModule = liveTable ? getModule(liveTable.game) : null;
        if (!liveTable || !liveDealer || !liveModule?.virtual) {
          return;
        }
        if (liveDealer.dealing || liveDealer.awaiting === "action") {
          return;
        }
        if (liveTable.settings.virtual.autoTrigger !== true) {
          return;
        }
        const request = resolveVirtualRequest("trigger", liveModule, undefined, undefined);
        if (!request) {
          return;
        }
        executeVirtualStep({
          io,
          registry,
          table: liveTable,
          module: liveModule,
          virtualDealer: liveDealer,
          actionTimer: registry.getActionTimer(code),
          request,
          clientId: `auto-${Date.now()}`,
        });
      }, delayMs);
    }

    function handleVirtual(
      socket: Socket,
      msg: Record<string, unknown>,
      st: SocketState,
      limiter: ReturnType<typeof createRateLimiter>,
    ): void {
      const parsed = virtualMessageSchema.safeParse(msg);
      if (!parsed.success || !st.code || !st.role || !st.joined) {
        return;
      }

      if (st.role === "display") {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "not authorized",
        });
        return;
      }

      if (st.role === "dealer" && tableIsDemoted(st, socket)) {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "demoted",
        });
        return;
      }

      const table = registry.get(st.code);
      if (!table) {
        return;
      }

      const composed = table.getComposed();
      if (composed.platform.participation.outcomeSource !== "virtual") {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "NOT_VIRTUAL",
        });
        return;
      }

      if (!config.enableVirtual) {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "VIRTUAL_DISABLED",
        });
        return;
      }

      const virtualDealer = registry.getVirtualDealer(st.code);
      if (!virtualDealer) {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "NOT_VIRTUAL",
        });
        return;
      }

      const module = getModule(table.game);
      if (!module?.virtual) {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "UNSUPPORTED_GAME",
        });
        return;
      }

      if (parsed.data.kind === "force" && st.role !== "dealer") {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "not authorized",
        });
        return;
      }

      const turn = module.turn?.(composed.module);

      if (parsed.data.kind === "action") {
        if (st.role !== "player" || !st.playerId) {
          socket.emit("message", {
            op: "reject",
            clientId: parsed.data.clientId,
            reason: "not authorized",
          });
          return;
        }
        if (turn?.playerId !== st.playerId) {
          socket.emit("message", {
            op: "reject",
            clientId: parsed.data.clientId,
            reason: "not authorized",
          });
          return;
        }
      }

      if (
        parsed.data.kind === "trigger" &&
        st.role === "player" &&
        turn?.playerId !== st.playerId
      ) {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "not authorized",
        });
        return;
      }

      if (parsed.data.kind === "trigger" && st.role !== "dealer" && st.role !== "player") {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "not authorized",
        });
        return;
      }

      if (
        virtualDealer.awaiting === "action" &&
        parsed.data.kind === "trigger" &&
        st.role !== "dealer"
      ) {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "awaiting action",
        });
        return;
      }

      if (virtualDealer.dealing) {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "DEALING",
        });
        return;
      }

      if (
        !limiter.tryConsume(`virtual:${st.code}`, VIRTUAL_TRIGGER_LIMIT, VIRTUAL_TRIGGER_WINDOW_MS)
      ) {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "rate limit exceeded",
        });
        return;
      }

      let forceDefault: unknown;
      if (parsed.data.kind === "force" && virtualDealer.awaiting === "action") {
        try {
          forceDefault = defaultActionForModule(module);
        } catch {
          socket.emit("message", {
            op: "reject",
            clientId: parsed.data.clientId,
            reason: "virtual step failed",
          });
          return;
        }
      }

      const turnPlayerId =
        parsed.data.kind === "force" && virtualDealer.awaiting === "action"
          ? (turn?.playerId ?? undefined)
          : st.playerId;

      const request = resolveVirtualRequest(
        parsed.data.kind,
        module,
        parsed.data.payload,
        turnPlayerId,
        forceDefault,
      );

      if (!request) {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "not authorized",
        });
        return;
      }

      const clientId = parsed.data.clientId;
      executeVirtualStep({
        io,
        registry,
        table,
        module,
        virtualDealer,
        actionTimer: registry.getActionTimer(st.code),
        request,
        clientId,
        onAck: (seq) => {
          socket.emit("message", { op: "ack", clientId, seq });
        },
        onReject: (reason) => {
          socket.emit("message", { op: "reject", clientId, reason });
        },
      });
    }

    function tableIsDemoted(st: SocketState, sock: Socket): boolean {
      if (!st.code) {
        return false;
      }
      const table = registry.get(st.code);
      return table?.isDemoted(sock.id) ?? false;
    }
  });
}
