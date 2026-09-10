import type { BaccaratResult } from "./types.js";

export function describeBaccaratResult(result: BaccaratResult): string {
  const banker = result.bankerTotal !== null ? `Banker ${result.bankerTotal}` : "Banker";
  const player = result.playerTotal !== null ? `Player ${result.playerTotal}` : "Player";
  return `${banker} – ${player}`;
}
