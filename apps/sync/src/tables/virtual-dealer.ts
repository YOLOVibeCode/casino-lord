import {
  bytesToHex,
  commitFor,
  createSeededRng,
  hexToBytes,
  triggerForKind,
  type Rng,
  type TableEvent,
  type VirtualTrigger,
} from "@casino-lord/core";
import { randomBytes } from "node:crypto";
import type { UntypedModule } from "../modules.js";
import type { TableInstance } from "./table-instance.js";

export interface ScheduledEvent {
  event: Omit<TableEvent, "seq" | "at">;
  at: string;
  /** Ephemeral events are broadcast only, never persisted. */
  broadcastOnly?: boolean;
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

export class VirtualDealer {
  private state: VirtualDealerState;

  constructor(
    private readonly tableCode: string,
    seriesId: string,
    seed?: Uint8Array,
  ) {
    const seriesSeed = seed ?? randomBytes(32);
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

  /** True while a paced reveal sequence is still being emitted (§14.4). */
  dealing = false;

  get awaiting(): "none" | "action" | "trigger" {
    return this.state.awaiting;
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

  getTurnHint(
    table: TableInstance,
    module: UntypedModule,
  ): { playerId: string | null; prompt: string } | null {
    if (!module.turn) {
      return null;
    }
    const composed = table.getComposed();
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

  private rotateSeries(auto: boolean, label?: string): Omit<TableEvent, "seq" | "at">[] {
    const ended = this.endSeriesEvent();
    const newSeriesId = crypto.randomUUID();
    const newSeed = randomBytes(32);
    this.state = {
      seriesId: newSeriesId,
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
    table: TableInstance,
    module: UntypedModule,
    request: VirtualStepRequest,
  ): Omit<TableEvent, "seq" | "at">[] {
    if (!module.virtual) {
      throw new Error("module has no virtual handler");
    }

    const composed = table.getComposed();
    const rules = table.getEffectiveRules();
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
    } as Parameters<NonNullable<UntypedModule["virtual"]>["step"]>[0];

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

export function defaultActionForModule(module: UntypedModule): unknown {
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
