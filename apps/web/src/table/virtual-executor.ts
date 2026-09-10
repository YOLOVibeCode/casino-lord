import type { TableEvent, TableSettings } from "@casino-lord/core";
import type { UntypedGameModule } from "./module-types.js";
import type { VirtualPendingState } from "./sync-store-types.js";
import {
  VirtualDealer,
  buildVirtualStatus,
  type ScheduledEvent,
  type VirtualStepRequest,
  type VirtualTableContext,
} from "./virtual-dealer.js";

export interface ExecuteLocalVirtualOptions {
  ctx: VirtualTableContext;
  module: UntypedGameModule;
  virtualDealer: VirtualDealer;
  request: VirtualStepRequest;
  id: () => string;
  appendPersisted: (event: Omit<TableEvent, "seq" | "at">, at: string) => void;
  onEphemeral: (event: TableEvent) => void;
  onVirtualStatus: () => void;
  onVirtualPending: (pending: VirtualPendingState | null) => void;
  getVirtualSettings: () => TableSettings["virtual"];
  onComplete?: () => void;
  onReject?: (reason: string) => void;
}

export function executeLocalVirtualStep(options: ExecuteLocalVirtualOptions): void {
  const {
    ctx,
    module,
    virtualDealer,
    request,
    id,
    appendPersisted,
    onEphemeral,
    onVirtualStatus,
    onVirtualPending,
    getVirtualSettings,
    onComplete,
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
    stepEvents = virtualDealer.runStep(ctx, module, request);
  } catch {
    onReject?.("virtual step failed");
    return;
  }

  const settings = getVirtualSettings();
  const kind = module.virtual.kind;
  const startedAt = Date.now();
  const scheduled = virtualDealer.schedulePacedEvents(
    stepEvents,
    new Date(startedAt).toISOString(),
    settings,
    kind,
  );

  virtualDealer.dealing = true;
  onVirtualPending(null);

  void runScheduledEvents({
    virtualDealer,
    scheduled,
    ctx,
    module,
    id,
    appendPersisted,
    onEphemeral,
    onVirtualStatus,
    onVirtualPending,
    ...(onComplete !== undefined ? { onComplete } : {}),
  });
}

interface RunScheduledOptions {
  virtualDealer: VirtualDealer;
  scheduled: ScheduledEvent[];
  ctx: VirtualTableContext;
  module: UntypedGameModule;
  id: () => string;
  appendPersisted: (event: Omit<TableEvent, "seq" | "at">, at: string) => void;
  onEphemeral: (event: TableEvent) => void;
  onVirtualStatus: () => void;
  onVirtualPending: (pending: VirtualPendingState | null) => void;
  onComplete?: () => void;
}

async function runScheduledEvents(opts: RunScheduledOptions): Promise<void> {
  const {
    virtualDealer,
    scheduled,
    ctx,
    module,
    id,
    appendPersisted,
    onEphemeral,
    onVirtualStatus,
    onVirtualPending,
    onComplete,
  } = opts;

  try {
    for (let index = 0; index < scheduled.length; index++) {
      const { event, at, broadcastOnly } = scheduled[index]!;
      const wait = Date.parse(at) - Date.now();
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }

      if (broadcastOnly) {
        const typed = event as TableEvent;
        if (typed.type === "VIRTUAL_PENDING") {
          onVirtualPending({ kind: typed.kind, untilAt: typed.untilAt });
        }
        onEphemeral({ ...event, seq: -1, at } as TableEvent);
        continue;
      }

      appendPacedEvent({
        ctx,
        event,
        at,
        id,
        appendPersisted,
        onEphemeral,
      });
    }
  } finally {
    virtualDealer.dealing = false;
    onVirtualPending(null);
    onVirtualStatus();
    buildVirtualStatus(ctx, module, virtualDealer);
    onComplete?.();
  }
}

function appendPacedEvent(input: {
  ctx: VirtualTableContext;
  event: Omit<TableEvent, "seq" | "at">;
  at: string;
  id: () => string;
  appendPersisted: (event: Omit<TableEvent, "seq" | "at">, at: string) => void;
  onEphemeral: (event: TableEvent) => void;
}): void {
  const { ctx, event, at, id, appendPersisted, onEphemeral } = input;
  let body: Omit<TableEvent, "seq" | "at"> = event;
  const typedEvent = body as TableEvent;

  if (typedEvent.type === "LIVE_INPUT") {
    onEphemeral({ ...typedEvent, seq: -1, at } as TableEvent);
  }

  if (typedEvent.type === "RESULT_RECORDED") {
    const composed = ctx.getComposed();
    body = {
      type: "RESULT_RECORDED",
      result: {
        ...typedEvent.result,
        id: id(),
        index: composed.platform.results.length,
        recordedAt: at,
      },
    } as Omit<TableEvent, "seq" | "at">;
  }

  appendPersisted(body, at);
}
