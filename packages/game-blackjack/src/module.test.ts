import { describe, expect, it } from "vitest";
import { assertReplayDeterministic, type TableEvent } from "@casino-lord/core";
import { blackjackModule } from "./module.js";
import { reduce } from "./reducer.js";
import { initialState } from "./state.js";
import { DEFAULT_BLACKJACK_RULES } from "./rules.js";
import type { Card } from "./types.js";

function c(rank: Card["rank"], suit: Card["suit"] = "S"): Card {
  return { rank, suit };
}

function ev(seq: number, body: Record<string, unknown> & { type: string }): TableEvent {
  return {
    seq,
    at: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
    ...body,
  } as TableEvent;
}

describe("blackjackModule", () => {
  it("has correct metadata", () => {
    expect(blackjackModule.id).toBe("blackjack");
    expect(blackjackModule.seriesLabel).toBe("Shoe");
    expect(blackjackModule.resultLabel).toBe("Round");
    expect(blackjackModule.layouts.map((l) => l.id)).toEqual([
      "classic",
      "dealer-focus",
      "stats-focus",
      "portrait",
    ]);
    expect(blackjackModule.animationEvents).toHaveLength(10);
    expect(blackjackModule.virtual?.kind).toBe("shoe");
  });

  it("assertReplayDeterministic with edit and delete", () => {
    const result = (id: string, index: number) => ({
      id,
      index,
      recordedAt: `2026-01-01T00:00:${index}.000Z`,
      quick: false,
      source: "physical" as const,
      by: "dealer" as const,
      data: {
        dealer: { cards: [c("10"), c("7")], total: 17, bust: false, blackjack: false },
        seats: {
          1: [
            {
              cards: [],
              doubled: false,
              fromSplit: false,
              surrendered: false,
              outcome: "lose" as const,
            },
          ],
        },
        depth: "outcomes" as const,
        dealerError: false,
      },
    });

    const events: TableEvent[] = [
      ev(1, { type: "SERIES_STARTED", seriesId: "s1" }),
      ev(2, { type: "RESULT_RECORDED", result: result("r0", 0) }),
      ev(3, { type: "RESULT_RECORDED", result: result("r1", 1) }),
      ev(4, {
        type: "RESULT_EDITED",
        result: {
          ...result("r0", 0),
          data: {
            ...result("r0", 0).data,
            seats: {
              1: [
                {
                  cards: [],
                  doubled: false,
                  fromSplit: false,
                  surrendered: false,
                  outcome: "win" as const,
                },
              ],
            },
          },
        },
      }),
      ev(5, { type: "RESULT_DELETED", resultId: "r1" }),
    ];

    expect(() =>
      assertReplayDeterministic(events, blackjackModule, DEFAULT_BLACKJACK_RULES),
    ).not.toThrow();

    let state = initialState();
    for (const event of events) {
      state = reduce(state, event, DEFAULT_BLACKJACK_RULES);
    }
    expect(state.rounds).toHaveLength(1);
  });

  it("importSeries returns error on invalid text", () => {
    const result = blackjackModule.importSeries("NOT_VALID", DEFAULT_BLACKJACK_RULES);
    expect("error" in result).toBe(true);
  });

  it("describeResult formats dealer and seat bust", () => {
    expect(
      blackjackModule.describeResult?.(
        {
          dealer: { cards: [], total: 20, bust: false, blackjack: false },
          seats: {
            2: [
              {
                cards: [],
                doubled: false,
                fromSplit: false,
                surrendered: false,
                outcome: "bust",
              },
            ],
          },
          depth: "outcomes",
          dealerError: false,
        },
        DEFAULT_BLACKJACK_RULES,
      ),
    ).toBe("Dealer 20, seat 2 bust");
  });
});
