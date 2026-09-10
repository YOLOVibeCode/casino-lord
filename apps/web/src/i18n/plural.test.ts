import { describe, expect, it } from "vitest";
import { formatPlural } from "./plural.js";

describe("formatPlural", () => {
  it("selects singular for 1 and plural otherwise", () => {
    expect(formatPlural(1, "bet", "bets")).toBe("bet");
    expect(formatPlural(2, "bet", "bets")).toBe("bets");
    expect(formatPlural(0, "bet", "bets")).toBe("bets");
  });
});
