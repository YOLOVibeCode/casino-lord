import { describe, expect, it } from "vitest";
import { actionSchema, crapsPlayerActions } from "./actions.js";

describe("actionSchema", () => {
  it("accepts roll", () => {
    expect(actionSchema.parse({ kind: "roll" })).toEqual({ kind: "roll" });
  });
});

describe("crapsPlayerActions", () => {
  it("disables working-bet defs so shell cannot emit empty betId", () => {
    const working = crapsPlayerActions.filter((a) =>
      ["toggle_working", "press", "take_down"].includes(a.id),
    );
    for (const def of working) {
      expect(def.enabled?.({} as never, {} as never)).toBe(false);
    }
  });

  it("includes roll for shell detection", () => {
    const roll = crapsPlayerActions.find((a) => a.id === "roll");
    expect(roll).toEqual({ id: "roll", label: "ROLL", action: { kind: "roll" } });
  });
});
