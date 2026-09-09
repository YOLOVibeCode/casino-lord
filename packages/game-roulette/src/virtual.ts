import type { Rng, TableEvent } from "@casino-lord/core";
import { wheelOrder } from "./wheel.js";
import type { RouletteRules } from "./rules.js";
import type { RouletteState } from "./state.js";

export function virtualWheelStep(
  _state: RouletteState,
  rules: RouletteRules,
  rng: Rng,
): { events: Omit<TableEvent, "seq" | "at">[]; awaiting: "none" | "action" | "trigger" } {
  const order = wheelOrder(rules);
  const index = rng.next(order.length);
  const pocket = order[index]!;

  const events: Omit<TableEvent, "seq" | "at">[] = [
    {
      type: "LIVE_INPUT",
      payload: { pending: null, spinning: true },
      source: "system",
    } as Omit<TableEvent, "seq" | "at">,
    {
      type: "RESULT_RECORDED",
      result: {
        id: "virtual-pending",
        index: 0,
        recordedAt: "",
        quick: false,
        source: "virtual",
        by: "system",
        rng: { from: index, to: index + 1 },
        data: { pocket },
      },
    } as Omit<TableEvent, "seq" | "at">,
  ];

  return { events, awaiting: "none" };
}
