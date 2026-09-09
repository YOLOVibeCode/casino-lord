import type { RoadHand } from "../types.js";
import type { BeadCell, RoadGrid } from "./types.js";

const ROWS = 6;

export function buildBeadPlate(hands: RoadHand[]): RoadGrid<BeadCell> {
  if (hands.length === 0) {
    return { rows: ROWS, cols: 0, cells: Array.from({ length: ROWS }, () => []) };
  }

  const cols = Math.ceil(hands.length / ROWS);
  const cells: BeadCell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: cols }, (): BeadCell => ({ kind: "empty" })),
  );

  for (let i = 0; i < hands.length; i++) {
    const col = Math.floor(i / ROWS);
    const row = i % ROWS;
    const hand = hands[i]!;
    cells[row]![col] = {
      kind: "result",
      outcome: hand.outcome,
      playerPair: hand.playerPair,
      bankerPair: hand.bankerPair,
    };
  }

  return { rows: ROWS, cols, cells };
}
