import { describe, expect, it } from "vitest";
import { isValidPlayerColor, PLAYER_COLORS, validatePlayerName } from "./player-colors.js";

describe("player-colors", () => {
  it("has 12 colours", () => {
    expect(PLAYER_COLORS).toHaveLength(12);
  });

  it("validates palette membership", () => {
    expect(isValidPlayerColor(PLAYER_COLORS[0]!)).toBe(true);
    expect(isValidPlayerColor("#000000")).toBe(false);
  });

  it("validates player names", () => {
    expect(validatePlayerName("  Ana  ")).toEqual({ ok: true, name: "Ana" });
    expect(validatePlayerName("A").ok).toBe(false);
    expect(validatePlayerName("<script>").ok).toBe(false);
  });
});
