import { describe, expect, it } from "vitest";
import { exportRoll, importText } from "./serialize.js";
import { normalizeResult } from "./engine.js";

describe("export → import round-trip", () => {
  it("handles mixed face/total tokens", () => {
    const text = "4-4 6-2 5-3 3-4 | 6-5 2-2 5-5 1-6 | 8 9 7";
    const imported = importText(text);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    expect(imported.results).toHaveLength(11);
    expect(imported.results[0]).toEqual(normalizeResult({ a: 4, b: 4 }));
    expect(imported.results[9]?.total).toBe(9);

    const exported = imported.results.map((r) => exportRoll(r)).join(" ");
    expect(exported).toContain("4-4");
    expect(exported).toContain("8");
  });
});
