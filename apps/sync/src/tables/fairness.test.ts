import { describe, expect, it } from "vitest";
import { buildFairnessResponse, listSeriesFairness } from "./fairness.js";
import { ev } from "@casino-lord/core/testing";

describe("fairness helpers", () => {
  it("lists series with commit and seedRevealed flags", () => {
    const events = [
      ev(1, "2026-01-01T00:00:01.000Z", {
        type: "SERIES_STARTED",
        seriesId: "s1",
        commit: "a".repeat(64),
      }),
      ev(2, "2026-01-01T00:00:02.000Z", {
        type: "SERIES_ENDED",
        seriesId: "s1",
        seed: "010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
      }),
      ev(3, "2026-01-01T00:00:03.000Z", {
        type: "SERIES_STARTED",
        seriesId: "s2",
        commit: "b".repeat(64),
      }),
    ];

    const list = listSeriesFairness(events);
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({
      number: 1,
      seriesId: "s1",
      commit: "a".repeat(64),
      seedRevealed: true,
    });
    expect(list[1]).toEqual({
      number: 2,
      seriesId: "s2",
      commit: "b".repeat(64),
      seedRevealed: false,
    });
  });

  it("returns seriesId in fairness response", () => {
    const events = [
      ev(1, "2026-01-01T00:00:01.000Z", {
        type: "SERIES_STARTED",
        seriesId: "s1",
        commit: "a".repeat(64),
      }),
      ev(2, "2026-01-01T00:00:02.000Z", {
        type: "RESULT_RECORDED",
        result: {
          id: "r1",
          index: 0,
          recordedAt: "2026-01-01T00:00:02.000Z",
          quick: true,
          source: "virtual",
          by: "system",
          rng: { from: 0, to: 37 },
          data: { pocket: 17 },
        },
      }),
    ];

    const response = buildFairnessResponse(events, 1, "K7X2PQ", "s1");
    expect(response.seriesId).toBe("s1");
    expect(response.seriesNumber).toBe(1);
    expect(response.draws).toEqual([{ from: 0, to: 37 }]);
  });
});
