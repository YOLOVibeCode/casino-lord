import { describe, expect, it } from "vitest";
import { classifyRoll, detectHard, normalizeResult, theoreticalDistribution } from "./engine.js";

describe("hard-way detection", () => {
  it("classifies all 36 face combinations", () => {
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        const hard = detectHard(a as 1, b as 1);
        const total = a + b;
        if (a === b && (total === 4 || total === 6 || total === 8 || total === 10)) {
          expect(hard).toBe(true);
        } else if (a === b) {
          expect(hard).toBe(false);
        } else {
          expect(hard).toBe(false);
        }
      }
    }
  });
});

describe("pass-line FSM (Appendix A)", () => {
  const comeOutCases: Array<[number, string, string]> = [
    [7, "natural", "come_out"],
    [11, "natural", "come_out"],
    [2, "craps", "come_out"],
    [3, "craps", "come_out"],
    [12, "craps", "come_out"],
    [4, "point_established", "point"],
    [5, "point_established", "point"],
    [6, "point_established", "point"],
    [8, "point_established", "point"],
    [9, "point_established", "point"],
    [10, "point_established", "point"],
  ];

  it.each(comeOutCases)("come-out total %i → %s", (total, decision, nextPhase) => {
    const result = normalizeResult({ a: null, b: null, total });
    const info = classifyRoll(result, "come_out", null);
    expect(info.decision).toBe(decision);
    if (nextPhase === "point") {
      expect(info.pointAfter).toBe(total);
    } else {
      expect(info.pointAfter).toBeNull();
    }
  });

  it("point phase: point made", () => {
    const result = normalizeResult({ a: 4, b: 4, total: 8 });
    const info = classifyRoll(result, "point", 8);
    expect(info.decision).toBe("point_made");
    expect(info.pointAfter).toBeNull();
  });

  it("point phase: seven out", () => {
    const result = normalizeResult({ a: 4, b: 3, total: 7 });
    const info = classifyRoll(result, "point", 8);
    expect(info.decision).toBe("seven_out");
  });

  it("point phase: no decision", () => {
    const result = normalizeResult({ a: 2, b: 3, total: 5 });
    const info = classifyRoll(result, "point", 8);
    expect(info.decision).toBe("none");
    expect(info.pointAfter).toBe(8);
  });
});

describe("theoretical distribution (Appendix B)", () => {
  it("matches 1-2-3-4-5-6-5-4-3-2-1 / 36", () => {
    const dist = theoreticalDistribution();
    expect(dist[7]).toBeCloseTo(6 / 36);
    expect(dist[2]).toBeCloseTo(1 / 36);
    expect(dist[12]).toBeCloseTo(1 / 36);
    expect(dist.slice(2, 13).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});
