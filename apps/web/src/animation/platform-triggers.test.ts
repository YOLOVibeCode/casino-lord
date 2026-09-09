import { describe, expect, it } from "vitest";
import { DEFAULT_TABLE_SETTINGS } from "@casino-lord/core";
import { derivePlatformAnimations } from "./platform-triggers.js";
import { initialPlatformState } from "@casino-lord/core";

describe("derivePlatformAnimations", () => {
  const basePlatform = {
    ...initialPlatformState(),
    settings: DEFAULT_TABLE_SETTINGS,
    players: [{ id: "p1", name: "Ana", color: "#f00", status: "active" as const, joinedAt: "" }],
    bankrolls: { p1: 500 },
  };

  it("emits bets_open on BETS_OPENED", () => {
    const prev = { module: {}, platform: basePlatform };
    const next = { module: {}, platform: basePlatform };
    const triggers = derivePlatformAnimations(prev, next, {
      seq: 1,
      at: "",
      type: "BETS_OPENED",
      roundId: "r1",
    });
    expect(triggers).toEqual([{ eventId: "bets_open", vars: {} }]);
  });

  it("emits big_win when settlement profit exceeds threshold", () => {
    const prev = { module: {}, platform: { ...basePlatform, bankrolls: { p1: 400 } } };
    const next = {
      module: {},
      platform: {
        ...basePlatform,
        bankrolls: { p1: 600 },
        settlements: {
          r1: [{ betId: "b1", outcome: "win" as const, returned: 200, profit: 200 }],
        },
        bets: [
          {
            id: "b1",
            playerId: "p1",
            roundId: "r1",
            type: "high",
            amount: 100,
            declared: false,
            working: false,
            placedAt: "",
            originRoundId: "r1",
          },
        ],
      },
    };
    const triggers = derivePlatformAnimations(prev, next, {
      seq: 2,
      at: "",
      type: "RESULT_RECORDED",
      result: {
        id: "res1",
        index: 0,
        recordedAt: "",
        quick: false,
        source: "physical",
        by: "dealer",
        data: {},
        roundId: "r1",
      },
    });
    expect(triggers.some((t) => t.eventId === "big_win")).toBe(true);
  });
});
