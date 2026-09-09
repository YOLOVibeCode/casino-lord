import { describe, expect, it } from "vitest";
import type { TableEvent } from "@casino-lord/core";
import { currentSeriesCommit } from "./meta.js";

describe("currentSeriesCommit", () => {
  it("returns the latest series commitment prefix source", () => {
    const events: TableEvent[] = [
      {
        seq: 1,
        at: "2026-01-01T00:00:00.000Z",
        type: "SERIES_STARTED",
        seriesId: "s1",
        commit: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      },
      {
        seq: 2,
        at: "2026-01-01T00:00:01.000Z",
        type: "SERIES_STARTED",
        seriesId: "s2",
        commit: "1111111122222222333333334444444445555555555555555555555555555555",
      },
    ];
    expect(currentSeriesCommit(events)).toBe(
      "1111111122222222333333334444444445555555555555555555555555555555",
    );
  });
});
