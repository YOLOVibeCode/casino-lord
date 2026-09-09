import { describe, expect, it } from "vitest";
import { exportRound, importText } from "./serialize.js";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";
import type { BlackjackResult, Card } from "./types.js";

function c(rank: Card["rank"], suit: Card["suit"] = "S"): Card {
  return { rank, suit };
}

describe("export import round-trip", () => {
  it("round-trips outcomes, full, and quick in one file", () => {
    const text = [
      "D:7S,KD,4H | 1:L | 2:L | 5:BJ",
      "D:6C,9H,7D | 1:9H,AC | 2:KS,8D | 3:6C,5H,9S d",
      "D:BUST",
    ].join("\n");

    const imported = importText(text, DEFAULT_BLACKJACK_RULES);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.rounds).toHaveLength(3);
    expect(imported.rounds[0]!.result.depth).toBe("outcomes");
    expect(imported.rounds[2]!.result.depth).toBe("quick");

    const reExported = imported.rounds.map((r) => exportRound(r.result));
    expect(reExported[2]).toBe("D:BUST");
  });
});
