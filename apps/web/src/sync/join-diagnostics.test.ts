import { describe, expect, it } from "vitest";
import {
  appendJoinTrace,
  formatJoinDiagnostics,
  type JoinDiagnosticReport,
} from "./join-diagnostics.js";

describe("join diagnostics", () => {
  it("caps the trace list at 40 entries", () => {
    let traces = appendJoinTrace([], "first");
    for (let i = 0; i < 45; i++) {
      traces = appendJoinTrace(traces, `e${i}`);
    }
    expect(traces).toHaveLength(40);
    expect(traces[0]?.event).not.toBe("first");
    expect(traces[traces.length - 1]?.event).toBe("e44");
  });

  it("formats a report the phone can copy", () => {
    const report: JoinDiagnosticReport = {
      phase: "join",
      tableCode: "K7X2PQ",
      href: "https://casinonight.app/play/K7X2PQ",
      syncUrl: "https://casinonight.app",
      online: true,
      connectionState: "reconnecting",
      rejectReason: null,
      playerId: "p1",
      traces: [{ at: "2026-09-12T02:00:00.000Z", event: "http-join-ok", detail: "pending=false" }],
      userAgent: "TestUA",
    };
    const text = formatJoinDiagnostics(report);
    expect(text).toContain("table=K7X2PQ");
    expect(text).toContain("connection=reconnecting");
    expect(text).toContain("http-join-ok pending=false");
    expect(text).toContain("ua=TestUA");
  });
});
