import { describe, expect, it } from "vitest";
import { exportBody, importBody } from "./serialize.js";
import { DEFAULT_ROULETTE_RULES } from "./rules.js";

describe("export/import round-trip", () => {
  it("round-trips European session", () => {
    const body = "17 32 0 5 22 14 - 36 1 1 1";
    const imported = importBody(body, DEFAULT_ROULETTE_RULES);
    expect("error" in imported).toBe(false);
    if ("error" in imported) return;
    expect(exportBody(imported.results)).toBe(body);
  });

  it("round-trips American session with 00", () => {
    const rules = { ...DEFAULT_ROULETTE_RULES, wheel: "american" as const };
    const body = "17 00 36";
    const imported = importBody(body, rules);
    expect("error" in imported).toBe(false);
    if ("error" in imported) return;
    expect(exportBody(imported.results)).toBe(body);
  });

  it("rejects 00 on European wheel", () => {
    const result = importBody("17 00", DEFAULT_ROULETTE_RULES);
    expect("error" in result).toBe(true);
  });
});
