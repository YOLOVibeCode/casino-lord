import type { Player, TableEvent } from "@casino-lord/core";
import { describe, expect, it } from "vitest";
import type { BlackjackLiveInput } from "../types.js";
import { deriveSeatIntents } from "./seat-intents.js";

function ev(seq: number, body: Record<string, unknown> & { type: string }): TableEvent {
  return {
    seq,
    at: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
    ...body,
  } as TableEvent;
}

const PLAYERS: Player[] = [
  {
    id: "p1",
    name: "Ana",
    color: "#f00",
    status: "active",
    joinedAt: "2026-01-01T00:00:00.000Z",
    seat: 3,
  },
];

const PHYSICAL_LIVE: BlackjackLiveInput = {
  dealer: [],
  seats: {
    3: [{ cards: [], doubled: false, fromSplit: false, surrendered: false, outcome: null }],
  },
};

describe("deriveSeatIntents", () => {
  it("returns intent label for active seat on physical tables", () => {
    const events = [ev(1, { type: "PLAYER_ACTION", playerId: "p1", action: "hit", intent: true })];
    expect(deriveSeatIntents(events, PLAYERS, PHYSICAL_LIVE, 3)).toEqual({ 3: "HIT" });
  });

  it("returns empty map on virtual tables", () => {
    const events = [ev(1, { type: "PLAYER_ACTION", playerId: "p1", action: "hit", intent: true })];
    const live: BlackjackLiveInput = {
      ...PHYSICAL_LIVE,
      virtual: {
        shoe: [],
        shoeIndex: 0,
        phase: "player",
        activeSeats: [3],
        currentSeat: 3,
        currentHandIndex: 0,
        holeDealt: true,
        dealRound: 2,
        completedHands: [],
      },
    };
    expect(deriveSeatIntents(events, PLAYERS, live, 3)).toEqual({});
  });

  it("clears intent after LIVE_INPUT adds a card to the seat", () => {
    const events = [
      ev(1, { type: "PLAYER_ACTION", playerId: "p1", action: "hit", intent: true }),
      ev(2, {
        type: "LIVE_INPUT",
        payload: {
          dealer: [],
          seats: {
            3: [
              {
                cards: [{ rank: "9", suit: "H" }],
                doubled: false,
                fromSplit: false,
                surrendered: false,
                outcome: null,
              },
            ],
          },
        },
        source: "dealer",
      }),
    ];
    expect(deriveSeatIntents(events, PLAYERS, PHYSICAL_LIVE, 3)).toEqual({});
  });

  it("hides intent when active seat differs (dealer moved on)", () => {
    const events = [
      ev(1, { type: "PLAYER_ACTION", playerId: "p1", action: "stand", intent: true }),
    ];
    expect(deriveSeatIntents(events, PLAYERS, PHYSICAL_LIVE, 2)).toEqual({});
  });
});
