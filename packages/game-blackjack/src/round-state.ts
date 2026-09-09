import type { BlackjackRules } from "./rules.js";
import { computeDealerFromCards, resolveRoundSeats, validateDealerPlay } from "./engine.js";
import type { BlackjackLiveInput, BlackjackResult, EntryDepth, HandInput, Seat } from "./types.js";

export interface RoundEvaluation {
  depth: EntryDepth;
  dealerValidation: ReturnType<typeof validateDealerPlay>;
  ready: boolean;
  hint: string;
  warnings: string[];
}

function countResolvedSeats(seats: Partial<Record<Seat, HandInput[]>>): number {
  let n = 0;
  for (const hands of Object.values(seats)) {
    if (hands?.some((h) => h.outcome !== null || h.cards.length > 0)) n++;
  }
  return n;
}

function countOutcomes(seats: Partial<Record<Seat, HandInput[]>>): {
  wins: number;
  losses: number;
  pushes: number;
} {
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  for (const hands of Object.values(seats)) {
    for (const hand of hands ?? []) {
      const o = hand.outcome;
      if (o === "win" || o === "blackjack") wins++;
      else if (o === "lose" || o === "bust" || o === "surrender") losses++;
      else if (o === "push") pushes++;
    }
  }
  return { wins, losses, pushes };
}

export function evaluateLiveInput(
  live: BlackjackLiveInput,
  rules: BlackjackRules,
): RoundEvaluation {
  const warnings: string[] = [];
  const validation = validateDealerPlay(live.dealer, rules);
  const dealerTotal = validation.total;

  let hint = "";
  if (live.dealer.length === 0) {
    hint = "Enter dealer up card";
  } else if (validation.dealerStatus === "must_draw") {
    hint = `Dealer ${dealerTotal} — must draw`;
  } else if (validation.dealerStatus === "bust") {
    hint = `Dealer BUST ${dealerTotal}`;
  } else if (validation.dealerStatus === "blackjack") {
    hint = "Dealer BLACKJACK";
  } else if (validation.dealerStatus === "stands") {
    hint = `Dealer ${dealerTotal}${validation.soft ? " soft" : ""} — stands`;
  }

  const resolvedSeats = countResolvedSeats(live.seats);
  const { wins, losses, pushes } = countOutcomes(live.seats);
  if (resolvedSeats > 0) {
    hint += ` · ${resolvedSeats} seats · ${wins}W ${losses}L ${pushes}P`;
  }

  const hasIllegal = validation.illegalActions.length > 0;
  const allowOverride = live.recordDespiteDealerError === true;
  const dealerComplete =
    validation.dealerStatus === "stands" ||
    validation.dealerStatus === "bust" ||
    validation.dealerStatus === "blackjack";

  const depth = rules.entryDepth;
  let ready = false;

  if (depth === "outcomes") {
    ready =
      live.dealer.length >= 1 &&
      dealerComplete &&
      resolvedSeats > 0 &&
      (!hasIllegal || allowOverride);
  } else if (depth === "full") {
    ready =
      live.dealer.length >= 2 &&
      dealerComplete &&
      resolvedSeats > 0 &&
      (!hasIllegal || allowOverride);
  }

  if (hasIllegal && !allowOverride) {
    warnings.push(...validation.illegalActions);
  }

  return {
    depth,
    dealerValidation: validation,
    ready,
    hint,
    warnings,
  };
}

export function liveInputToResult(
  live: BlackjackLiveInput,
  rules: BlackjackRules,
  depth: EntryDepth,
): BlackjackResult {
  const dealer = computeDealerFromCards(live.dealer, rules);
  let seats = live.seats;

  if (depth === "full") {
    seats = resolveRoundSeats(live.seats, live.dealer, rules);
  }

  return {
    dealer,
    seats,
    depth,
    dealerError:
      (live.recordDespiteDealerError ?? false) &&
      validateDealerPlay(live.dealer, rules).illegalActions.length > 0,
  };
}
