import { describe, expect, it } from "vitest";
import { formatBoardLabel } from "./board-labels.js";

describe("formatBoardLabel", () => {
  it("returns English for EN", () => {
    expect(formatBoardLabel("Player", "EN")).toBe("Player");
    expect(formatBoardLabel("Bead Plate", "EN")).toBe("Bead Plate");
  });

  it("returns Chinese for ZH", () => {
    expect(formatBoardLabel("Player", "ZH")).toBe("闲");
    expect(formatBoardLabel("Banker", "ZH")).toBe("庄");
  });

  it("returns dual labels for EN+ZH", () => {
    expect(formatBoardLabel("Player", "EN+ZH")).toBe("Player / 闲");
    expect(formatBoardLabel("Bead Plate", "EN+ZH")).toBe("Bead Plate / 珠盘");
    expect(formatBoardLabel("Red", "EN+ZH")).toBe("Red / 红");
  });

  it("passes through unknown keys unchanged", () => {
    expect(formatBoardLabel("Hands this shoe", "EN+ZH")).toBe("Hands this shoe");
  });
});
