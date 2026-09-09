import {
  bytesToHex,
  commitFor,
  createSeededRng,
  hexToBytes,
  type Rng,
  type TableEvent,
} from "@casino-lord/core";
import {
  baccaratVirtualStep,
  type BaccaratRules,
  type BaccaratState,
  type VirtualShoeSession,
} from "@casino-lord/game-baccarat";
import { randomBytes } from "node:crypto";
import type { UntypedModule } from "../modules.js";
import type { TableInstance } from "./table-instance.js";

export interface PacedEvent {
  event: Omit<TableEvent, "seq" | "at">;
  at: string;
}

export interface VirtualDealerState {
  seriesId: string;
  seed: Uint8Array;
  rng: Rng;
  session: VirtualShoeSession | null;
  awaiting: "none" | "action" | "trigger";
  drawLog: Array<{ from: number; to: number }>;
}

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
    trigger: "deal" | "spin" | "roll" = "deal",
  ): Omit<TableEvent, "seq" | "at">[] {
    if (!module.virtual) {
      throw new Error("module has no virtual handler");
    }

    const composed = table.getComposed();
    const rules = table.getEffectiveRules();
    const moduleState = composed.module;

    if (module.id !== "baccarat") {
      throw new Error("virtual dealer slice supports baccarat only");
    }

    const out = baccaratVirtualStep({
      state: moduleState as BaccaratState,
      rules: rules as BaccaratRules,
      rng: this.loggingRng(),
      trigger,
      session: this.state.session,
      seriesId: this.state.seriesId,
    });

    this.state.session = out.session;
    this.state.awaiting = out.awaiting;

    const events: Omit<TableEvent, "seq" | "at">[] = [];

    for (const rawEvent of out.events) {
      const event = rawEvent as TableEvent;
      if (event.type === "SERIES_ENDED" || event.type === "SERIES_STARTED") {
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

    if (out.seriesRollover) {
      events.push(...this.rotateSeries(true, module.seriesLabel));
    }

    return events;
  }

  paceEvents(
    events: Omit<TableEvent, "seq" | "at">[],
    baseAt: string,
    revealDelayMs: number,
  ): PacedEvent[] {
    let t = Date.parse(baseAt);
    const paced: PacedEvent[] = [];
    let seenLive = false;

    for (const event of events) {
      if (event.type === "LIVE_INPUT") {
        if (seenLive) {
          t += revealDelayMs;
        }
        seenLive = true;
      }
      paced.push({ event, at: new Date(t).toISOString() });
    }

    return paced;
  }

  static fromSeed(tableCode: string, seriesId: string, seedHex: string): VirtualDealer {
    return new VirtualDealer(tableCode, seriesId, hexToBytes(seedHex));
  }
}
