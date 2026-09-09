import type { ConfirmState } from "@casino-lord/core";
import { liveInputToResult } from "./round-state.js";
import type { BlackjackRules } from "./rules.js";
import type { BlackjackState } from "./state.js";
import type { BlackjackResult } from "./types.js";

const OUTCOME_COLORS: Record<string, string> = {
  win: "#2BB673",
  blackjack: "#D4AF37",
  lose: "#D7263D",
  bust: "#D7263D",
  push: "#9AA0A6",
  surrender: "#9AA0A6",
};

function confirmLabel(result: BlackjackResult): string {
  const dealerPart = result.dealer.bust
    ? "DEALER BUST"
    : result.dealer.blackjack
      ? "DEALER BJ"
      : result.dealer.total !== null
        ? `DEALER ${result.dealer.total}`
        : "DEALER";

  let wins = 0;
  let losses = 0;
  let pushes = 0;
  for (const hands of Object.values(result.seats)) {
    for (const hand of hands ?? []) {
      const o = hand.outcome;
      if (o === "win" || o === "blackjack") wins++;
      else if (o === "lose" || o === "bust" || o === "surrender") losses++;
      else if (o === "push") pushes++;
    }
  }

  return `${dealerPart} · ${wins}W ${losses}L ${pushes}P`;
}

export function blackjackConfirm(
  state: BlackjackState,
  rules: BlackjackRules,
): ConfirmState<BlackjackResult> | null {
  const eval_ = state.roundEvaluation;
  const hasIllegal = eval_.dealerValidation.illegalActions.length > 0;
  const allowOverride = state.liveInput.recordDespiteDealerError === true;
  const preview = liveInputToResult(state.liveInput, rules, rules.entryDepth);

  if (hasIllegal && !allowOverride) {
    return {
      label: confirmLabel(preview),
      color: "#D7263D",
      badges: eval_.dealerValidation.illegalActions,
      enabled: false,
      result: null,
    };
  }

  if (!eval_.ready) return null;

  const result = liveInputToResult(state.liveInput, rules, rules.entryDepth);
  const badges: string[] = [];
  if (result.dealerError) badges.push("DEALER ERROR");

  return {
    label: confirmLabel(result),
    color: result.dealer.bust ? "#E08A1E" : "#EDE6D6",
    badges,
    enabled: true,
    result,
  };
}

export { OUTCOME_COLORS };
