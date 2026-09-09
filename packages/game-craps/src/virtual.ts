import type { Rng, VirtualTrigger } from "@casino-lord/core";
import type { TableEvent } from "@casino-lord/core";
import type { CrapsAction } from "./actions.js";
import type { CrapsRules } from "./rules.js";
import type { CrapsState, Face } from "./types.js";

export function crapsVirtualStep(input: {
  state: CrapsState;
  rules: CrapsRules;
  rng: Rng;
  trigger: VirtualTrigger;
  action?: { playerId: string; action: CrapsAction };
}): { events: Omit<TableEvent, "seq" | "at">[]; awaiting: "none" | "action" | "trigger" } {
  void input.state;
  void input.rules;
  void input.trigger;
  void input.action;

  const a = (input.rng.next(6) + 1) as Face;
  const b = (input.rng.next(6) + 1) as Face;
  const total = a + b;
  const hard = a === b && (total === 4 || total === 6 || total === 8 || total === 10);

  const events: Omit<TableEvent, "seq" | "at">[] = [
    {
      type: "LIVE_INPUT",
      payload: { a, b },
      source: "system",
    } as Omit<TableEvent, "seq" | "at">,
    {
      type: "RESULT_RECORDED",
      result: {
        id: `virtual-${a}-${b}`,
        index: input.state.results.length,
        recordedAt: "",
        quick: false,
        source: "virtual",
        by: "system",
        data: { a, b, total, hard: hard ? true : a !== b ? false : null },
      },
    } as Omit<TableEvent, "seq" | "at">,
  ];

  return { events, awaiting: "none" };
}
