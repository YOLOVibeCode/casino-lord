import { describe, expect, it } from "vitest";
import { getCurrentSeriesResults } from "./series-selectors.js";
import { replay } from "./replay.js";
import {
  createStubModule,
  ev,
  houseSettings,
  resultEnvelope,
  STUB_RULES,
} from "./testing/stub-module.js";

const module = createStubModule();

function baseEvents() {
  const settings = houseSettings();
  return [
    ev(1, "2026-01-01T00:00:01.000Z", {
      type: "TABLE_CREATED",
      game: "baccarat",
      participation: settings.participation,
      settings,
    }),
    ev(2, "2026-01-01T00:00:02.000Z", { type: "SERIES_STARTED", seriesId: "s1" }),
  ];
}

describe("currentSeriesResults", () => {
  it("appends on RESULT_RECORDED including without roundId", () => {
    const events = [
      ...baseEvents(),
      ev(3, "2026-01-01T00:00:03.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("res1", 0, 15),
      }),
    ];

    const state = replay(events, module, STUB_RULES, { code: "K7X2PQ" });
    expect(getCurrentSeriesResults(state.platform)).toEqual([
      expect.objectContaining({ id: "res1", index: 0 }),
    ]);
  });

  it("tracks record, undo, edit, delete, and series reset", () => {
    const events = [
      ...baseEvents(),
      ev(3, "2026-01-01T00:00:03.000Z", { type: "BETS_OPENED", roundId: "r1" }),
      ev(4, "2026-01-01T00:00:04.000Z", { type: "BETS_CLOSED", roundId: "r1", by: "dealer" }),
      ev(5, "2026-01-01T00:00:05.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("res1", 0, 15, "r1"),
      }),
      ev(6, "2026-01-01T00:00:06.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("res2", 1, 5),
      }),
      ev(7, "2026-01-01T00:00:07.000Z", { type: "RESULT_UNDONE", resultId: "res2" }),
      ev(8, "2026-01-01T00:00:08.000Z", {
        type: "RESULT_EDITED",
        result: resultEnvelope("res1", 0, 20, "r1"),
      }),
      ev(9, "2026-01-01T00:00:09.000Z", { type: "RESULT_DELETED", resultId: "res1" }),
      ev(10, "2026-01-01T00:00:10.000Z", {
        type: "SERIES_STARTED",
        seriesId: "s2",
      }),
      ev(11, "2026-01-01T00:00:11.000Z", {
        type: "RESULT_RECORDED",
        result: resultEnvelope("res3", 0, 3),
      }),
    ];

    const afterTwo = replay(events.slice(0, 6), module, STUB_RULES, { code: "K7X2PQ" });
    expect(getCurrentSeriesResults(afterTwo.platform).map((r) => r.id)).toEqual(["res1", "res2"]);

    const afterUndo = replay(events.slice(0, 7), module, STUB_RULES, { code: "K7X2PQ" });
    expect(getCurrentSeriesResults(afterUndo.platform).map((r) => r.id)).toEqual(["res1"]);

    const afterEdit = replay(events.slice(0, 8), module, STUB_RULES, { code: "K7X2PQ" });
    expect(getCurrentSeriesResults(afterEdit.platform)[0]?.data).toEqual({ value: 20 });

    const afterDelete = replay(events.slice(0, 9), module, STUB_RULES, { code: "K7X2PQ" });
    expect(getCurrentSeriesResults(afterDelete.platform)).toEqual([]);

    const afterSeries = replay(events, module, STUB_RULES, { code: "K7X2PQ" });
    expect(getCurrentSeriesResults(afterSeries.platform).map((r) => r.id)).toEqual(["res3"]);
  });
});
