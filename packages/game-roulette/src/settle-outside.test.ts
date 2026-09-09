import { describe, expect, it } from "vitest";
import { DEFAULT_ROULETTE_RULES } from "./rules.js";
import { settleOne } from "./test-helpers.js";

describe("outside bet settlement", () => {
  it("pays dozen win", () => {
    const s = settleOne("dozen", 100, 5, DEFAULT_ROULETTE_RULES, { kind: "dozen", n: 1 });
    expect(s.outcome).toBe("win");
    expect(s.profit).toBe(200);
  });

  it("loses red on black", () => {
    const s = settleOne("red", 100, 2, DEFAULT_ROULETTE_RULES, { kind: "red" });
    expect(s.outcome).toBe("lose");
  });

  it("loses even-money on zero with no zero rule", () => {
    const s = settleOne("red", 100, 0, DEFAULT_ROULETTE_RULES, { kind: "red" });
    expect(s.outcome).toBe("lose");
  });
});
