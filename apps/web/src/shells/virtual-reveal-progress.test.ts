import { describe, expect, it } from "vitest";
import type { TableEvent } from "@casino-lord/core";
import {
  countSystemLiveInputsSinceLastResult,
  revealProgressLabel,
} from "./virtual-reveal-progress.js";

describe("countSystemLiveInputsSinceLastResult", () => {
  it("counts system LIVE_INPUT after the latest RESULT_RECORDED", () => {
    const events: TableEvent[] = [
      {
        seq: 1,
        at: "t0",
        type: "LIVE_INPUT",
        payload: {},
        source: "system",
      },
      {
        seq: 2,
        at: "t1",
        type: "RESULT_RECORDED",
        result: {
          id: "r1",
          index: 1,
          recordedAt: "t1",
          quick: false,
          source: "virtual",
          by: "system",
          data: {},
        },
      },
      {
        seq: 3,
        at: "t2",
        type: "LIVE_INPUT",
        payload: {},
        source: "system",
      },
      {
        seq: 4,
        at: "t3",
        type: "LIVE_INPUT",
        payload: {},
        source: "system",
      },
      {
        seq: 5,
        at: "t4",
        type: "LIVE_INPUT",
        payload: {},
        source: "dealer",
      },
    ];
    expect(countSystemLiveInputsSinceLastResult(events)).toBe(2);
  });

  it("counts from start when no RESULT_RECORDED yet", () => {
    const events: TableEvent[] = [
      {
        seq: 1,
        at: "t0",
        type: "LIVE_INPUT",
        payload: {},
        source: "system",
      },
    ];
    expect(countSystemLiveInputsSinceLastResult(events)).toBe(1);
  });
});

describe("revealProgressLabel", () => {
  it("formats shoe reveal progress", () => {
    expect(revealProgressLabel(0, "shoe")).toBe("Dealing…");
    expect(revealProgressLabel(3, "shoe")).toBe("Dealing… card 3 revealed");
  });

  it("formats dice and wheel fallbacks", () => {
    expect(revealProgressLabel(0, "dice")).toBe("Dealing… rolling");
    expect(revealProgressLabel(1, "dice")).toBe("Dealing… dice revealed");
    expect(revealProgressLabel(0, "wheel")).toBe("Dealing… spinning");
    expect(revealProgressLabel(1, "wheel")).toBe("Dealing… result incoming");
  });
});
