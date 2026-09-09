import { describe, expect, it } from "vitest";
import { deriveCrapsAnimations } from "./animations.js";
import { initialState } from "./state.js";
import { reduce } from "./reducer.js";
import { DEFAULT_CRAPS_RULES } from "./rules.js";

describe("deriveCrapsAnimations", () => {
  it("fires point_made on point made roll", () => {
    let prev = initialState();
    prev = reduce(
      prev,
      { seq: 1, at: "", type: "SERIES_STARTED", seriesId: "s1" },
      DEFAULT_CRAPS_RULES,
    );
    prev = reduce(
      prev,
      {
        seq: 2,
        at: "",
        type: "RESULT_RECORDED",
        result: {
          id: "r1",
          index: 0,
          recordedAt: "",
          quick: false,
          source: "physical",
          by: "dealer",
          data: { a: 4, b: 4, total: 8, hard: true },
        },
      },
      DEFAULT_CRAPS_RULES,
    );
    const event = {
      seq: 3,
      at: "",
      type: "RESULT_RECORDED",
      result: {
        id: "r2",
        index: 1,
        recordedAt: "",
        quick: false,
        source: "physical",
        by: "dealer",
        data: { a: 4, b: 4, total: 8, hard: true },
      },
    } as const;
    const next = reduce(prev, event, DEFAULT_CRAPS_RULES);
    const triggers = deriveCrapsAnimations(prev, next, event);
    expect(triggers.some((t) => t.eventId === "point_made")).toBe(true);
  });
});
