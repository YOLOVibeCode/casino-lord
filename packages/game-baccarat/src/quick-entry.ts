import type { Outcome, RoadHand } from "./types.js";

export function parseOutcomeToken(token: string): RoadHand {
  const upper = token.trim().toUpperCase();
  if (!upper) throw new Error("Empty outcome token");

  let outcome: Outcome;
  let rest: string;

  if (upper.startsWith("B")) {
    outcome = "B";
    rest = upper.slice(1);
  } else if (upper.startsWith("P")) {
    outcome = "P";
    rest = upper.slice(1);
  } else if (upper.startsWith("T")) {
    outcome = "T";
    rest = upper.slice(1);
  } else {
    throw new Error(`Invalid outcome token: ${token}`);
  }

  let playerPair = false;
  let bankerPair = false;

  for (const ch of rest) {
    if (ch === "B") bankerPair = true;
    else if (ch === "P") playerPair = true;
    else throw new Error(`Invalid pair suffix in token: ${token}`);
  }

  return { outcome, playerPair, bankerPair };
}

export function formatOutcomeToken(hand: RoadHand): string {
  let token = hand.outcome;
  if (hand.bankerPair) token += "b";
  if (hand.playerPair) token += "p";
  return token;
}
