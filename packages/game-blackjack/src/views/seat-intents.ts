import type { Player, TableEvent } from "@casino-lord/core";
import type { BlackjackLiveInput, HandInput, Seat } from "../types.js";

const ACTION_LABELS: Record<string, string> = {
  hit: "HIT",
  stand: "STAND",
  double: "DOUBLE",
  split: "SPLIT",
  surrender: "SURRENDER",
};

function cardCountForSeat(seats: Partial<Record<Seat, HandInput[]>>, seat: Seat): number {
  const hands = seats[seat] ?? [];
  return hands.reduce((n, hand) => n + hand.cards.length, 0);
}

function playerSeatMap(players: readonly Player[]): Map<string, Seat> {
  const map = new Map<string, Seat>();
  for (const player of players) {
    const seat = player.seat;
    if (seat !== undefined && seat >= 1 && seat <= 7) {
      map.set(player.id, seat as Seat);
    }
  }
  return map;
}

export function deriveSeatIntents(
  events: readonly TableEvent[],
  players: readonly Player[],
  liveInput: BlackjackLiveInput,
  activeSeat: Seat,
): Partial<Record<Seat, string>> {
  if (liveInput.virtual !== undefined) {
    return {};
  }

  const seatsByPlayer = playerSeatMap(players);
  const cardCounts: Partial<Record<Seat, number>> = {};
  const pending: Partial<Record<Seat, string>> = {};

  for (const event of events) {
    if (event.type === "PLAYER_UPDATED") {
      const patch = event.patch;
      if ("seat" in patch) {
        if (patch.seat !== undefined && patch.seat >= 1 && patch.seat <= 7) {
          seatsByPlayer.set(event.playerId, patch.seat as Seat);
        } else {
          seatsByPlayer.delete(event.playerId);
        }
      }
      continue;
    }

    if (event.type === "LIVE_INPUT") {
      const payload = event.payload as BlackjackLiveInput;
      for (let s = 1; s <= 7; s++) {
        const seat = s as Seat;
        const nextCount = cardCountForSeat(payload.seats, seat);
        const prevCount = cardCounts[seat] ?? 0;
        if (nextCount > prevCount && pending[seat] !== undefined) {
          delete pending[seat];
        }
        cardCounts[seat] = nextCount;
      }
      continue;
    }

    if (event.type === "PLAYER_ACTION") {
      if (!event.intent) continue;
      const seat = seatsByPlayer.get(event.playerId);
      if (seat === undefined) continue;
      const action = String(event.action);
      pending[seat] = ACTION_LABELS[action] ?? action.toUpperCase();
    }
  }

  const label = pending[activeSeat];
  if (label === undefined) {
    return {};
  }
  return { [activeSeat]: label };
}
