import type { TableEvent } from "@casino-lord/core";
import type { Server } from "socket.io";
import type { UntypedModule } from "../modules.js";
import type { TableRegistry } from "./registry.js";
import type { TableInstance } from "./table-instance.js";
import type { VirtualActionTimer } from "./action-timer.js";
import { triggerForKind } from "@casino-lord/core";
import { VirtualDealer, type ScheduledEvent, type VirtualStepRequest } from "./virtual-dealer.js";

function room(code: string): string {
  return `table:${code}`;
}

export interface VirtualStatus {
  awaiting: "none" | "action" | "trigger";
  turnPlayerId?: string;
  turnPrompt?: string;
}

export function buildVirtualStatus(
  table: TableInstance,
  module: UntypedModule,
  virtualDealer: VirtualDealer,
): VirtualStatus {
  const hint = virtualDealer.getTurnHint(table, module);
  return {
    awaiting: virtualDealer.awaiting,
    ...(hint?.playerId ? { turnPlayerId: hint.playerId } : {}),
    ...(hint?.prompt ? { turnPrompt: hint.prompt } : {}),
  };
}

export function emitVirtualStatus(
  io: Server,
  code: string,
  table: TableInstance,
  module: UntypedModule,
  virtualDealer: VirtualDealer,
): void {
  io.to(room(code)).emit("message", {
    op: "virtualStatus",
    ...buildVirtualStatus(table, module, virtualDealer),
  });
}

export interface ExecuteVirtualOptions {
  io: Server;
  registry: TableRegistry;
  table: TableInstance;
  module: UntypedModule;
  virtualDealer: VirtualDealer;
  actionTimer: VirtualActionTimer;
  request: VirtualStepRequest;
  clientId: string;
  onAck?: (seq: number) => void;
  onReject?: (reason: string) => void;
}

export function executeVirtualStep(options: ExecuteVirtualOptions): void {
  const {
    io,
    registry,
    table,
    module,
    virtualDealer,
    actionTimer,
    request,
    clientId,
    onAck,
    onReject,
  } = options;

  if (virtualDealer.dealing) {
    onReject?.("DEALING");
    return;
  }

  if (!module.virtual) {
    onReject?.("UNSUPPORTED_GAME");
    return;
  }

  let stepEvents: Omit<TableEvent, "seq" | "at">[];
  try {
    stepEvents = virtualDealer.runStep(table, module, request);
  } catch {
    onReject?.("virtual step failed");
    return;
  }

  actionTimer.cancel();

  const settings = table.settings.virtual;
  const kind = module.virtual.kind;
  const startedAt = Date.now();
  const scheduled = virtualDealer.schedulePacedEvents(
    stepEvents,
    new Date(startedAt).toISOString(),
    settings,
    kind,
  );

  const code = table.code;
  const liveTable = table;
  virtualDealer.dealing = true;

  void runScheduledEvents({
    io,
    registry,
    code,
    liveTable,
    module,
    virtualDealer,
    actionTimer,
    scheduled,
    clientId,
    onAck: (seq) => {
      emitVirtualStatus(io, code, liveTable, module, virtualDealer);
      if (virtualDealer.awaiting === "action") {
        actionTimer.schedule(liveTable, module, virtualDealer, (req) => {
          executeVirtualStep({ ...options, request: req, clientId: `timer-${Date.now()}` });
        });
      }
      onAck?.(seq);
    },
  });
}

interface RunScheduledOptions {
  io: Server;
  registry: TableRegistry;
  code: string;
  liveTable: TableInstance;
  module: UntypedModule;
  virtualDealer: VirtualDealer;
  actionTimer: VirtualActionTimer;
  scheduled: ScheduledEvent[];
  clientId: string;
  onAck: (seq: number) => void;
}

async function runScheduledEvents(opts: RunScheduledOptions): Promise<void> {
  const { io, registry, code, liveTable, module, virtualDealer, scheduled, clientId, onAck } = opts;

  let lastSeq = liveTable.latestSeq;
  try {
    for (let index = 0; index < scheduled.length; index++) {
      const { event, at, broadcastOnly } = scheduled[index]!;
      const wait = Date.parse(at) - Date.now();
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }
      if (registry.get(code) !== liveTable) {
        return;
      }
      if (broadcastOnly) {
        io.to(room(code)).emit("message", {
          op: "event",
          event: { ...event, seq: -1, at },
        });
        continue;
      }
      lastSeq =
        appendPacedEvent({
          io,
          registry,
          code,
          liveTable,
          event,
          at,
          clientId,
          index,
        }) ?? lastSeq;
    }
  } finally {
    virtualDealer.dealing = false;
  }
  onAck(lastSeq);
}

function appendPacedEvent(input: {
  io: Server;
  registry: TableRegistry;
  code: string;
  liveTable: TableInstance;
  event: Omit<TableEvent, "seq" | "at">;
  at: string;
  clientId: string;
  index: number;
}): number | undefined {
  const { io, registry, code, liveTable, event, at, clientId, index } = input;
  let body: Omit<TableEvent, "seq" | "at"> = event;
  const typedEvent = body as TableEvent;

  if (typedEvent.type === "RESULT_RECORDED") {
    const latest = liveTable.getComposed();
    const results = (latest.module as { results?: unknown[] }).results ?? [];
    body = {
      type: "RESULT_RECORDED",
      result: {
        ...typedEvent.result,
        id: crypto.randomUUID(),
        index: results.length,
        recordedAt: at,
      },
    } as Omit<TableEvent, "seq" | "at">;
  }

  const result = liveTable.appendEvent(body, `${clientId}:${index}`, at);
  if (result.kind === "new") {
    if (result.persisted) {
      registry.persistEvent(code, result.event);
    }
    io.to(room(code)).emit("message", { op: "event", event: result.event });
    return result.event.seq;
  }
  return undefined;
}

export function resolveVirtualRequest(
  kind: "trigger" | "action" | "force",
  module: UntypedModule,
  payload: unknown,
  playerId: string | undefined,
  forceDefaultAction?: unknown,
): VirtualStepRequest | null {
  if (!module.virtual) {
    return null;
  }
  const trigger = triggerForKind(module.virtual.kind);

  if (kind === "trigger") {
    return { mode: "trigger", trigger };
  }
  if (kind === "action") {
    const actionPayload = payload as { action?: unknown } | undefined;
    if (!playerId || actionPayload?.action === undefined) {
      return null;
    }
    return { mode: "action", playerId, action: actionPayload.action };
  }
  if (forceDefaultAction !== undefined && playerId) {
    return { mode: "force-action", playerId, action: forceDefaultAction };
  }
  return { mode: "force-trigger", trigger };
}
