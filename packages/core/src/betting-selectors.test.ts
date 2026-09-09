import { describe, expect, it } from "vitest";
import { canUndoResult, getSettlementTicker, sortPlayers } from "./betting-selectors.js";
import { initialPlatformState } from "./platform-state.js";
import type { Player } from "./data-model.js";

describe("betting selectors", () => {
  it("formats settlement ticker", () => {
    const state = {
      ...initialPlatformState(),
      players: [
        {
          id: "p1",
          name: "Ana",
          color: "#f00",
          status: "active" as const,
          joinedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "p2",
          name: "Ben",
          color: "#0f0",
          status: "active" as const,
          joinedAt: "2026-01-01T00:00:01.000Z",
        },
      ],
      bets: [
        {
          id: "b1",
          playerId: "p1",
          roundId: "r1",
          type: "high",
          amount: 100,
          declared: false,
          working: false,
          placedAt: "2026-01-01T00:00:02.000Z",
          originRoundId: "r1",
        },
        {
          id: "b2",
          playerId: "p2",
          roundId: "r1",
          type: "high",
          amount: 100,
          declared: false,
          working: false,
          placedAt: "2026-01-01T00:00:03.000Z",
          originRoundId: "r1",
        },
      ],
      settlements: {
        r1: [
          { betId: "b1", outcome: "win", returned: 200, profit: 100 },
          { betId: "b2", outcome: "lose", returned: 0, profit: -100 },
        ],
      },
    };

    expect(getSettlementTicker(state, "r1")).toBe("Ana +100 · Ben -100");
  });

  it("blocks undo when later round has bets", () => {
    const state = {
      ...initialPlatformState(),
      participation: { playerMode: "on", bank: "house", outcomeSource: "physical" as const },
      rounds: [
        {
          id: "r1",
          status: "settled" as const,
          openedAt: "2026-01-01T00:00:01.000Z",
          resultId: "res1",
        },
        { id: "r2", status: "open" as const, openedAt: "2026-01-01T00:00:02.000Z" },
      ],
      bets: [
        {
          id: "b1",
          playerId: "p1",
          roundId: "r2",
          type: "high",
          amount: 50,
          declared: false,
          working: false,
          placedAt: "2026-01-01T00:00:03.000Z",
          originRoundId: "r2",
        },
      ],
    };

    const result = canUndoResult(state, "res1");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("next round");
  });

  it("sorts players by bankroll descending", () => {
    const players: Player[] = [
      {
        id: "a",
        name: "A",
        color: "#f00",
        status: "active",
        joinedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "b",
        name: "B",
        color: "#0f0",
        status: "active",
        joinedAt: "2026-01-01T00:00:01.000Z",
      },
    ];
    const state = {
      ...initialPlatformState(),
      players,
      bankrolls: { a: 100, b: 500 },
    };
    const sorted = sortPlayers(players, state, "bankroll");
    expect(sorted.map((p) => p.id)).toEqual(["b", "a"]);
  });
});
