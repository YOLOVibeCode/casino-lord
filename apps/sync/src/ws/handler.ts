import { normalizeTableCode } from "@casino-lord/core";
import type { Server, Socket } from "socket.io";
import { getModule } from "../modules.js";
import { createRateLimiter, DEALER_EVENT_LIMIT, DEALER_EVENT_WINDOW_MS } from "../rate-limit.js";
import { validateInboundEvent } from "../schemas/event-input.js";
import {
  eventMessageSchema,
  joinMessageSchema,
  pingMessageSchema,
  resyncMessageSchema,
} from "../schemas/messages.js";
import type { TableInstance } from "../tables/table-instance.js";
import type { TableRegistry } from "../tables/registry.js";
import { verifyToken } from "../tables/token.js";

interface SocketState {
  code?: string;
  role?: "dealer" | "display";
  joined?: boolean;
}

export interface WsHandlerOptions {
  registry: TableRegistry;
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
    players: [],
  });
}

function joinedPayload(table: TableInstance, role: "dealer" | "display", sinceSeq?: number) {
  const composed = table.getComposed();
  const delta = table.joinPayload(sinceSeq);
  const payload: Record<string, unknown> = {
    op: "joined",
    role,
    game: table.game,
    participation: composed.platform.participation,
    seq: table.latestSeq,
  };

  if (delta.snapshot) {
    payload.snapshot = delta.snapshot;
  } else if (delta.events) {
    payload.events = delta.events;
  }

  if (table.live !== undefined) {
    payload.live = table.live;
  }

  return payload;
}

export function attachWebSocket(io: Server, options: WsHandlerOptions): void {
  const { registry } = options;
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

      if (role === "player") {
        socket.emit("message", { op: "error", code: "PLAYERS_DISABLED" });
        return;
      }

      const code = normalizeTableCode(rawCode);
      const table = registry.get(code);
      if (!table) {
        socket.emit("message", { op: "error", code: "NOT_FOUND" });
        return;
      }

      if (table.sessionEnded) {
        socket.emit("message", { op: "error", code: "SESSION_ENDED" });
        return;
      }

      const module = getModule(table.game);
      if (!module) {
        socket.emit("message", { op: "error", code: "UNSUPPORTED_GAME" });
        return;
      }

      if (role === "dealer") {
        if (!token) {
          socket.emit("message", { op: "error", code: "BAD_TOKEN" });
          return;
        }
        const row = registry.get(code);
        if (!row || !verifyToken(token, row.dealerTokenHash)) {
          socket.emit("message", { op: "error", code: "BAD_TOKEN" });
          return;
        }

        const joinResult = table.onJoin("dealer", socket.id, takeover);
        if (joinResult.status === "DEALER_ACTIVE") {
          socket.emit("message", { op: "error", code: "DEALER_ACTIVE" });
          return;
        }

        if (joinResult.demotedSocketId) {
          io.sockets.sockets.get(joinResult.demotedSocketId)?.emit("message", { op: "demoted" });
        }
      } else {
        table.onJoin("display", socket.id);
      }

      void socket.join(room(code));
      st.code = code;
      st.role = role;
      st.joined = true;
      socket.data = st;

      socket.emit("message", joinedPayload(table, role, sinceSeq));
      sendPresence(io, table, code);
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

      socket.emit("message", joinedPayload(table, st.role, parsed.data.sinceSeq));
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

      if (st.role !== "dealer") {
        socket.emit("message", {
          op: "reject",
          clientId: parsed.data.clientId,
          reason: "not authorized",
        });
        return;
      }

      if (tableIsDemoted(st, socket)) {
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

      if (!limiter.tryConsume(`dealer:${socket.id}`, DEALER_EVENT_LIMIT, DEALER_EVENT_WINDOW_MS)) {
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

      const validation = validateInboundEvent(parsed.data.event, st.role, module);
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
