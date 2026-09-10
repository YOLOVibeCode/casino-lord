import {
  bytesToHex,
  commitFor,
  createSeededRng,
  hexToBytes,
  triggerForKind,
  type ComposedState,
  type Rng,
  type TableEvent,
  type VirtualTrigger,
} from "@casino-lord/core";
import type { UntypedGameModule } from "./module-types.js";

export interface ScheduledEvent {
  event: Omit<TableEvent, "seq" | "at">;
  at: string;
  broadcastOnly?: boolean;
}

export interface VirtualTableContext {
  getComposed(): ComposedState<unknown>;
  getRules(): unknown;
}

export interface VirtualDealerState {
  seriesId: string;
  seed: Uint8Array;
  rng: Rng;
  session: unknown;
  awaiting: "none" | "action" | "trigger";
  drawLog: Array<{ from: number; to: number }>;
}

export type VirtualStepRequest =
  | { mode: "trigger"; trigger: VirtualTrigger }
  | { mode: "action"; playerId: string; action: unknown }
  | { mode: "force-trigger"; trigger: VirtualTrigger }
  | { mode: "force-action"; playerId: string; action: unknown };

export function randomSeed(): Uint8Array {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  return seed;
}

export class VirtualDealer {
  private state: VirtualDealerState;

  constructor(
    private readonly tableCode: string,
    seriesId: string,
    seed?: Uint8Array,
  ) {
    const seriesSeed = seed ?? randomSeed();
    this.state = {
      seriesId,
      seed: seriesSeed,
      rng: createSeededRng(seriesSeed),
      session: null,
      awaiting: "trigger",
      drawLog: [],
    };
  }

  get seriesId(): string {
    return this.state.seriesId;
  }

  dealing = false;

  get awaiting(): "none" | "action" | "trigger" {
    return this.state.awaiting;
  }

  get session(): unknown {
    return this.state.session;
  }

  getCommit(): string {
    return commitFor(this.state.seed, this.tableCode, this.state.seriesId);
  }

  getSeedHex(): string {
    return bytesToHex(this.state.seed);
  }

  getDrawLog(): ReadonlyArray<{ from: number; to: number }> {
    return this.state.drawLog;
  }

  exportState(): {
    seriesId: string;
    seedHex: string;
    session: unknown;
    awaiting: VirtualDealerState["awaiting"];
  } {
    return {
      seriesId: this.state.seriesId,
      seedHex: this.getSeedHex(),
      session: this.state.session,
      awaiting: this.state.awaiting,
    };
  }

  restoreState(input: {
    seriesId: string;
    seedHex: string;
    session: unknown;
    awaiting: VirtualDealerState["awaiting"];
  }): void {
    const seed = hexToBytes(input.seedHex);
    this.state = {
      seriesId: input.seriesId,
      seed,
      rng: createSeededRng(seed),
      session: input.session,
      awaiting: input.awaiting,
      drawLog: [],
    };
  }

  getTurnHint(
    ctx: VirtualTableContext,
    module: UntypedGameModule,
  ): { playerId: string | null; prompt: string } | null {
    if (!module.turn) {
      return null;
    }
    const composed = ctx.getComposed();
    const turn = module.turn(composed.module);
    if (!turn) {
      return null;
    }
    return { playerId: turn.playerId, prompt: turn.prompt };
  }

  startSeriesEvent(label?: string, auto?: boolean): Omit<TableEvent, "seq" | "at"> {
    return {
      type: "SERIES_STARTED",
      seriesId: this.state.seriesId,
      ...(label !== undefined ? { label } : {}),
      ...(auto === true ? { auto: true } : {}),
      commit: this.getCommit(),
    } as Omit<TableEvent, "seq" | "at">;
  }

  endSeriesEvent(): Omit<TableEvent, "seq" | "at"> {
    return {
      type: "SERIES_ENDED",
      seriesId: this.state.seriesId,
      seed: this.getSeedHex(),
    } as Omit<TableEvent, "seq" | "at">;
  }

  rotateSeries(
    auto: boolean,
    label?: string,
    newSeriesId?: string,
  ): Omit<TableEvent, "seq" | "at">[] {
    const ended = this.endSeriesEvent();
    const nextSeriesId = newSeriesId ?? crypto.randomUUID();
    const newSeed = randomSeed();
    this.state = {
      seriesId: nextSeriesId,
      seed: newSeed,
      rng: createSeededRng(newSeed),
      session: null,
      awaiting: "trigger",
      drawLog: [],
    };
    return [ended, this.startSeriesEvent(label, auto)];
  }

  private loggingRng(): Rng {
    const base = this.state.rng;
    const log = this.state.drawLog;
    const wrapped: Rng = {
      next(n: number): number {
        const value = base.next(n);
        const draws = base.draws;
        if (draws) {
          log.push({ from: draws.from, to: draws.to });
        }
        return value;
      },
    };
    Object.defineProperty(wrapped, "draws", {
      get: () => base.draws,
    });
    return wrapped;
  }

  runStep(
    ctx: VirtualTableContext,
    module: UntypedGameModule,
    request: VirtualStepRequest,
  ): Omit<TableEvent, "seq" | "at">[] {
    if (!module.virtual) {
      throw new Error("module has no virtual handler");
    }

    const composed = ctx.getComposed();
    const rules = ctx.getRules();
    const moduleState = composed.module;
    const defaultTrigger = triggerForKind(module.virtual.kind);

    const stepInput = {
      state: moduleState,
      rules,
      rng: this.loggingRng(),
      trigger:
        request.mode === "trigger" || request.mode === "force-trigger"
          ? request.trigger
          : defaultTrigger,
      session: this.state.session,
      seriesId: this.state.seriesId,
      ...(request.mode === "action" || request.mode === "force-action"
        ? { action: { playerId: request.playerId, action: request.action } }
        : {}),
    } as Parameters<NonNullable<UntypedGameModule["virtual"]>["step"]>[0];

    const out = module.virtual.step(stepInput);

    if (out.session !== undefined) {
      this.state.session = out.session;
    }
    this.state.awaiting = out.awaiting;

    const events: Omit<TableEvent, "seq" | "at">[] = [];
    let seriesRollover = false;

    for (const rawEvent of out.events) {
      const event = rawEvent as TableEvent;
      if (event.type === "SERIES_ENDED" || event.type === "SERIES_STARTED") {
        seriesRollover = true;
        continue;
      }
      if (event.type === "RESULT_RECORDED") {
        const draws = this.state.rng.draws;
        events.push({
          type: "RESULT_RECORDED",
          result: {
            ...event.result,
            rng: draws ?? event.result.rng,
          },
        } as Omit<TableEvent, "seq" | "at">);
        continue;
      }
      events.push(rawEvent);
    }

    if (seriesRollover) {
      events.push(...this.rotateSeries(true, module.seriesLabel));
    }

    return events;
  }

  schedulePacedEvents(
    events: Omit<TableEvent, "seq" | "at">[],
    baseAt: string,
    virtualSettings: {
      revealDelayMs: number;
      diceTumbleMs: number;
      wheelSpinMs: number;
    },
    kind: "dice" | "shoe" | "wheel",
  ): ScheduledEvent[] {
    let t = Date.parse(baseAt);
    const scheduled: ScheduledEvent[] = [];

    if (kind === "shoe") {
      let seenLive = false;
      for (const event of events) {
        if (event.type === "LIVE_INPUT") {
          if (seenLive) {
            t += virtualSettings.revealDelayMs;
          }
          seenLive = true;
        }
        scheduled.push({ event, at: new Date(t).toISOString() });
      }
      return scheduled;
    }

    const pendingMs = kind === "dice" ? virtualSettings.diceTumbleMs : virtualSettings.wheelSpinMs;

    for (let i = 0; i < events.length; i++) {
      const event = events[i]!;
      if (event.type === "LIVE_INPUT") {
        scheduled.push({ event, at: new Date(t).toISOString() });
        const next = events[i + 1];
        if (next?.type === "RESULT_RECORDED") {
          const untilAt = new Date(t + pendingMs).toISOString();
          scheduled.push({
            event: { type: "VIRTUAL_PENDING", kind, untilAt } as Omit<TableEvent, "seq" | "at">,
            at: new Date(t).toISOString(),
            broadcastOnly: true,
          });
          t += pendingMs;
          continue;
        }
      }
      scheduled.push({ event, at: new Date(t).toISOString() });
    }

    return scheduled;
  }

  static fromSeed(tableCode: string, seriesId: string, seedHex: string): VirtualDealer {
    return new VirtualDealer(tableCode, seriesId, hexToBytes(seedHex));
  }
}

export function defaultActionForModule(module: UntypedGameModule): unknown {
  const stand = module.playerActions?.find((a) => a.id === "stand");
  if (stand) {
    return stand.action;
  }
  const first = module.playerActions?.[0];
  if (first) {
    return first.action;
  }
  throw new Error("module has no default action");
}

export function buildVirtualStatus(
  ctx: VirtualTableContext,
  module: UntypedGameModule,
  virtualDealer: VirtualDealer,
): {
  awaiting: "none" | "action" | "trigger";
  turnPlayerId?: string;
  turnPrompt?: string;
} {
  const hint = virtualDealer.getTurnHint(ctx, module);
  return {
    awaiting: virtualDealer.awaiting,
    ...(hint?.playerId ? { turnPlayerId: hint.playerId } : {}),
    ...(hint?.prompt ? { turnPrompt: hint.prompt } : {}),
  };
}

export function resolveVirtualRequest(
  kind: "trigger" | "action" | "force",
  module: UntypedGameModule,
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
