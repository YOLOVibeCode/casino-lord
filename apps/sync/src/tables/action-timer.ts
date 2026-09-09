import type { UntypedModule } from "../modules.js";
import type { TableInstance } from "./table-instance.js";
import { triggerForKind } from "@casino-lord/core";
import {
  defaultActionForModule,
  VirtualDealer,
  type VirtualStepRequest,
} from "./virtual-dealer.js";

export type ActionTimerCallback = (request: VirtualStepRequest) => void;

export interface ActionTimerDeps {
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export class VirtualActionTimer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;

  constructor(deps: ActionTimerDeps = {}) {
    this.setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;
  }

  cancel(): void {
    if (this.timer !== null) {
      this.clearTimeoutFn(this.timer);
      this.timer = null;
    }
  }

  schedule(
    table: TableInstance,
    module: UntypedModule,
    virtualDealer: VirtualDealer,
    onExpire: ActionTimerCallback,
  ): void {
    this.cancel();
    if (virtualDealer.awaiting !== "action") {
      return;
    }
    const turn = module.turn?.(table.getComposed().module);
    if (!turn?.playerId) {
      return;
    }
    const sec = table.settings.virtual.actionTimerSec;
    if (sec <= 0) {
      return;
    }
    this.timer = this.setTimeoutFn(() => {
      this.timer = null;
      try {
        const action = defaultActionForModule(module);
        onExpire({
          mode: "force-action",
          playerId: turn.playerId!,
          action,
        });
      } catch {
        // module has no default action — dealer must force manually
      }
    }, sec * 1000);
  }

  scheduleForceTrigger(
    table: TableInstance,
    module: UntypedModule,
    virtualDealer: VirtualDealer,
    onExpire: ActionTimerCallback,
  ): void {
    this.cancel();
    if (virtualDealer.awaiting !== "trigger" || !module.virtual) {
      return;
    }
    const sec = table.settings.virtual.actionTimerSec;
    if (sec <= 0) {
      return;
    }
    this.timer = this.setTimeoutFn(() => {
      this.timer = null;
      onExpire({ mode: "force-trigger", trigger: triggerForKind(module.virtual!.kind) });
    }, sec * 1000);
  }
}
