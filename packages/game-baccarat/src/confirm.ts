import type { ConfirmState } from "@casino-lord/core";
import type { BaccaratRules } from "./rules.js";
import type { BaccaratState } from "./state.js";
import type { BaccaratResult, Outcome } from "./types.js";

const OUTCOME_COLORS: Record<Outcome, string> = {
  P: "#2F6FE4",
  B: "#E5322D",
  T: "#2BB673",
};

const OUTCOME_LABELS: Record<Outcome, string> = {
  P: "PLAYER",
  B: "BANKER",
  T: "TIE",
};

function winningTotal(outcome: Outcome, playerTotal: number, bankerTotal: number): number {
  if (outcome === "P") return playerTotal;
  if (outcome === "B") return bankerTotal;
  return playerTotal;
}

export function baccaratConfirm(
  state: BaccaratState,
  _rules: BaccaratRules,
): ConfirmState<BaccaratResult> | null {
  const { handState, liveSlots } = state;

  if (handState.status !== "complete" || handState.errors.length > 0) {
    return null;
  }

  if (
    handState.outcome === null ||
    handState.playerTotal === null ||
    handState.bankerTotal === null
  ) {
    return null;
  }

  const outcome = handState.outcome;
  const total = winningTotal(outcome, handState.playerTotal, handState.bankerTotal);
  const badges: string[] = [];

  if (handState.playerPair) badges.push("P PAIR");
  if (handState.bankerPair) badges.push("B PAIR");
  if (handState.playerNatural || handState.bankerNatural) badges.push("NATURAL");

  const result: BaccaratResult = {
    cards: { ...liveSlots },
    outcome,
    playerTotal: handState.playerTotal,
    bankerTotal: handState.bankerTotal,
    playerPair: handState.playerPair,
    bankerPair: handState.bankerPair,
    natural: handState.playerNatural || handState.bankerNatural,
  };

  return {
    label: `✓ CONFIRM ${OUTCOME_LABELS[outcome]} ${total}`,
    color: OUTCOME_COLORS[outcome],
    ...(badges.length > 0 ? { badges } : {}),
    enabled: true,
    result,
  };
}
