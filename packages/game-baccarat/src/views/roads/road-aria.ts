import type { BeadCell, BigRoadGridCell, DerivedCell } from "../../roads/types.js";

export function beadCellAriaLabel(cell: BeadCell): string {
  if (cell.kind === "empty") return "Empty bead cell";
  const parts = [cell.outcome === "P" ? "Player" : cell.outcome === "B" ? "Banker" : "Tie"];
  if (cell.playerPair) parts.push("Player pair");
  if (cell.bankerPair) parts.push("Banker pair");
  return parts.join(", ");
}

export function bigRoadCellAriaLabel(cell: BigRoadGridCell): string {
  if (cell.kind === "empty") return "Empty big road cell";
  if (cell.kind === "leading-tie") {
    return cell.count > 1 ? `Leading ties, count ${cell.count}` : "Leading tie";
  }
  const side = cell.side === "P" ? "Player" : "Banker";
  const parts = [side];
  if (cell.ties > 0) parts.push(cell.ties > 1 ? `${cell.ties} ties` : "Tie");
  if (cell.playerPair) parts.push("Player pair");
  if (cell.bankerPair) parts.push("Banker pair");
  return parts.join(", ");
}

export function derivedCellAriaLabel(cell: DerivedCell, prediction?: "B" | "P"): string {
  if (cell.kind === "empty") {
    return prediction
      ? `Prediction if ${prediction === "B" ? "Banker" : "Player"}, empty`
      : "Empty derived cell";
  }
  const colour = cell.colour === "red" ? "Red" : "Blue";
  if (prediction) {
    return `Prediction if ${prediction === "B" ? "Banker" : "Player"}, ${colour}`;
  }
  return colour;
}
