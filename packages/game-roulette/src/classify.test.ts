import { describe, expect, it } from "vitest";
import { DEFAULT_ROULETTE_RULES, FRENCH_ROULETTE_RULES } from "./rules.js";
import {
  AMERICAN_WHEEL_ORDER,
  classifyPocket,
  EUROPEAN_WHEEL_ORDER,
  RED_NUMBERS,
  wheelPockets,
} from "./wheel.js";

describe("classifyPocket", () => {
  it("classifies all 37 European pockets", () => {
    for (const pocket of EUROPEAN_WHEEL_ORDER) {
      const info = classifyPocket(pocket, DEFAULT_ROULETTE_RULES);
      expect(info.pocket).toBe(pocket);
      expect(info.wheelIndex).toBe(EUROPEAN_WHEEL_ORDER.indexOf(pocket));
      if (pocket === 0) {
        expect(info.color).toBe("green");
        expect(info.parity).toBeNull();
      } else if (typeof pocket === "number") {
        expect(info.color).toBe(RED_NUMBERS.has(pocket) ? "red" : "black");
        expect(info.column).toBe(((pocket - 1) % 3) + 1);
        expect(info.dozen).toBe(Math.ceil(pocket / 12));
      }
    }
  });

  it("classifies all 38 American pockets including 00", () => {
    const rules = { ...DEFAULT_ROULETTE_RULES, wheel: "american" as const };
    for (const pocket of AMERICAN_WHEEL_ORDER) {
      const info = classifyPocket(pocket, rules);
      expect(info.wheelIndex).toBe(AMERICAN_WHEEL_ORDER.indexOf(pocket));
      if (pocket === "00" || pocket === 0) {
        expect(info.color).toBe("green");
        expect(info.sector).toBeNull();
      }
    }
  });

  it("assigns sectors on French wheel", () => {
    for (const pocket of wheelPockets(FRENCH_ROULETTE_RULES)) {
      const info = classifyPocket(pocket, FRENCH_ROULETTE_RULES);
      if ([12, 35, 3, 26, 0, 32, 15].includes(pocket as number)) {
        expect(info.sector).toBe("zero");
      } else {
        expect(info.sector).not.toBeNull();
      }
    }
  });
});
