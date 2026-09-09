import { describe, expect, it } from "vitest";
import { allInsideTargets } from "./targets.js";
import { wheelPockets } from "./wheel.js";
import { DEFAULT_ROULETTE_RULES } from "./rules.js";
import { settleOne } from "./test-helpers.js";
import { pocketInTarget } from "./targets.js";

describe("inside bet settlement", () => {
  it("settles every straight against every pocket", () => {
    const pockets = wheelPockets(DEFAULT_ROULETTE_RULES);
    for (const target of allInsideTargets(DEFAULT_ROULETTE_RULES)) {
      if (target.kind !== "straight") continue;
      for (const pocket of pockets) {
        const s = settleOne("straight", 100, pocket, DEFAULT_ROULETTE_RULES, target);
        const wins = pocketInTarget(pocket, target, DEFAULT_ROULETTE_RULES);
        expect(s.outcome).toBe(wins ? "win" : "lose");
        if (wins) expect(s.profit).toBe(3500);
      }
    }
  });

  it("settles split win and loss", () => {
    const win = settleOne("split", 100, 1, DEFAULT_ROULETTE_RULES, {
      kind: "split",
      pockets: [1, 2],
    });
    expect(win.outcome).toBe("win");
    expect(win.profit).toBe(1700);

    const loss = settleOne("split", 100, 3, DEFAULT_ROULETTE_RULES, {
      kind: "split",
      pockets: [1, 2],
    });
    expect(loss.outcome).toBe("lose");
  });

  it("settles basket on European wheel", () => {
    const win = settleOne("basket", 100, 2, DEFAULT_ROULETTE_RULES, { kind: "basket" });
    expect(win.outcome).toBe("win");
    expect(win.profit).toBe(800);
  });

  it("settles top line on American wheel", () => {
    const rules = { ...DEFAULT_ROULETTE_RULES, wheel: "american" as const };
    const win = settleOne("top_line", 100, "00", rules, { kind: "top_line" });
    expect(win.outcome).toBe("win");
    expect(win.profit).toBe(600);
  });
});
