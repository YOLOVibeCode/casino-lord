import { describe, expect, it, vi } from "vitest";
import type { UntypedModule } from "../modules.js";
import { VirtualActionTimer } from "./action-timer.js";
import type { VirtualDealer } from "./virtual-dealer.js";

function fakeModule(): UntypedModule {
  return {
    id: "baccarat",
    name: "Fake",
    seriesLabel: "Session",
    resultLabel: "Hand",
    defaultRules: {},
    rulesSchema: { safeParse: (v: unknown) => ({ success: true, data: v }) } as never,
    resultSchema: {} as never,
    liveInputSchema: {} as never,
    betTargetSchema: {} as never,
    initialState: () => ({}),
    reduce: (s) => s,
    confirm: () => null,
    DealerView: (() => null) as never,
    DisplayView: (() => null) as never,
    PlayerView: (() => null) as never,
    ResultDetailView: (() => null) as never,
    RulesSettingsView: (() => null) as never,
    bets: {} as never,
    settle: () => [],
    playerActions: [{ id: "stand", label: "Stand", action: "stand" as never }],
    turn: () => ({ playerId: "p1", prompt: "Your move" }),
    virtual: {
      kind: "shoe",
      step: () => ({ events: [], awaiting: "trigger" }),
    },
    animationEvents: [],
    deriveAnimations: () => [],
    stats: () => [],
    layouts: [],
    exportSeries: () => "",
    importSeries: () => ({ results: [], warnings: [] }),
  };
}

describe("VirtualActionTimer", () => {
  it("fires default stand action after actionTimerSec", () => {
    vi.useFakeTimers();
    const callbacks: Array<{ mode: string; action?: unknown; playerId?: string }> = [];
    const timer = new VirtualActionTimer();

    const module = fakeModule();
    const table = {
      getComposed: () => ({ module: {} }),
      settings: {
        virtual: { actionTimerSec: 2 },
      },
    } as never;

    const virtualDealer = { awaiting: "action" } as VirtualDealer;

    timer.schedule(table, module, virtualDealer, (req) => {
      callbacks.push(req as { mode: string; action?: unknown; playerId?: string });
    });

    vi.advanceTimersByTime(2000);
    expect(callbacks).toHaveLength(1);
    expect(callbacks[0]).toEqual({
      mode: "force-action",
      playerId: "p1",
      action: "stand",
    });

    timer.cancel();
    vi.useRealTimers();
  });
});
