import { collectCardsFromResult } from "./cards.js";
import { handValue, resolveRoundSeats, validateDealerPlay } from "./engine.js";
import { evaluateLiveInput, type RoundEvaluation } from "./round-state.js";
import { DEFAULT_BLACKJACK_RULES, type BlackjackRules } from "./rules.js";
import { ShoeTracker, countActiveHands } from "./shoe-tracker.js";
import type { BlackjackLiveInput, BlackjackResult, HandInput, Seat } from "./types.js";
import { ALL_SEATS } from "./types.js";

export interface RoundRecord {
  id: string;
  data: BlackjackResult;
}

export interface SeatStats {
  hands: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  busts: number;
}

export interface DealerStats {
  rounds: number;
  busts: number;
  blackjacks: number;
  totalsHistogram: number[];
}

export interface StreakInfo {
  side: "dealer" | "players";
  length: number;
}

export interface BlackjackState {
  rounds: RoundRecord[];
  liveInput: BlackjackLiveInput;
  roundEvaluation: RoundEvaluation;
  cardsSeen: number;
  cardsTotal: number;
  penetrationPct: number;
  penetrationEstimated: boolean;
  dealer: DealerStats;
  seats: Record<Seat, SeatStats>;
  streak: StreakInfo | null;
  fiveCardTwentyOnes: number;
}

function emptySeatStats(): SeatStats {
  return { hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, busts: 0 };
}

function initialSeatMap(): Record<Seat, SeatStats> {
  return {
    1: emptySeatStats(),
    2: emptySeatStats(),
    3: emptySeatStats(),
    4: emptySeatStats(),
    5: emptySeatStats(),
    6: emptySeatStats(),
    7: emptySeatStats(),
  };
}

function histogramIndex(total: number | null, bust: boolean): number {
  if (bust) return 5;
  if (total === null) return -1;
  if (total >= 17 && total <= 21) return total - 17;
  return -1;
}

function updateSeatStats(stats: SeatStats, outcome: HandInput["outcome"]): void {
  stats.hands++;
  if (outcome === "win") stats.wins++;
  else if (outcome === "blackjack") {
    stats.blackjacks++;
    stats.wins++;
  } else if (outcome === "push") stats.pushes++;
  else if (outcome === "bust") stats.busts++;
  else if (outcome === "lose" || outcome === "surrender") stats.losses++;
}

function computeStreak(rounds: RoundRecord[]): StreakInfo | null {
  if (rounds.length === 0) return null;

  let currentSide: "dealer" | "players" | null = null;
  let length = 0;

  for (let i = rounds.length - 1; i >= 0; i--) {
    const round = rounds[i]!.data;
    if (round.depth === "quick") continue;

    let seatWins = 0;
    let seatLosses = 0;
    for (const hands of Object.values(round.seats)) {
      for (const hand of hands ?? []) {
        const o = hand.outcome;
        if (o === "win" || o === "blackjack") seatWins++;
        else if (o === "lose" || o === "bust" || o === "surrender") seatLosses++;
      }
    }

    const side: "dealer" | "players" =
      seatWins > seatLosses ? "players" : seatWins < seatLosses ? "dealer" : "dealer";

    if (currentSide === null) {
      currentSide = side;
      length = 1;
    } else if (side === currentSide) {
      length++;
    } else {
      break;
    }
  }

  return currentSide ? { side: currentSide, length } : null;
}

function countFiveCard21s(result: BlackjackResult): number {
  let n = 0;
  for (const hands of Object.values(result.seats)) {
    for (const hand of hands ?? []) {
      if (hand.cards.length >= 5 && hand.outcome !== "bust") {
        if (handValue(hand.cards, hand.fromSplit).fiveCard21) n++;
      }
    }
  }
  return n;
}

function buildShoeStats(
  rules: BlackjackRules,
  rounds: RoundRecord[],
  liveInput: BlackjackLiveInput,
): { cardsSeen: number; cardsTotal: number; penetrationPct: number; estimated: boolean } {
  const tracker = new ShoeTracker(rules);
  let estimated = false;

  const estimateOnly =
    rules.entryDepth === "outcomes" && rounds.every((entry) => entry.data.depth !== "full");

  for (const entry of rounds) {
    const r = entry.data;
    if (r.depth === "full") {
      tracker.addCards(collectCardsFromResult(r.dealer.cards, r.seats));
    } else if (r.depth === "outcomes") {
      tracker.setEstimateMode(true);
      estimated = true;
      tracker.addCards(r.dealer.cards);
      tracker.addEstimatedHands(countActiveHands(r.seats));
    }
  }

  if (estimateOnly || (estimated && !rounds.some((r) => r.data.depth === "full"))) {
    tracker.setEstimateMode(true);
    estimated = true;
    if (liveInput.dealer.length > 0) {
      tracker.addCards(liveInput.dealer);
      tracker.addEstimatedHands(countActiveHands(liveInput.seats));
    }
  } else if (liveInput.dealer.length > 0) {
    tracker.addCards(collectCardsFromResult(liveInput.dealer, liveInput.seats));
  }

  return {
    cardsSeen: tracker.seenCount,
    cardsTotal: tracker.cardsTotal,
    penetrationPct: tracker.penetrationPct(),
    estimated,
  };
}

function buildDealerStats(rounds: RoundRecord[]): DealerStats {
  const stats: DealerStats = {
    rounds: 0,
    busts: 0,
    blackjacks: 0,
    totalsHistogram: [0, 0, 0, 0, 0, 0],
  };

  for (const entry of rounds) {
    const r = entry.data;
    if (r.depth === "quick") {
      stats.rounds++;
      if (r.dealer.bust) stats.busts++;
      if (r.dealer.blackjack) stats.blackjacks++;
      const idx = histogramIndex(r.dealer.total, r.dealer.bust);
      if (idx >= 0) stats.totalsHistogram[idx]!++;
      continue;
    }

    stats.rounds++;
    if (r.dealer.bust) stats.busts++;
    if (r.dealer.blackjack) stats.blackjacks++;
    const idx = histogramIndex(r.dealer.total, r.dealer.bust);
    if (idx >= 0) stats.totalsHistogram[idx]!++;
  }

  return stats;
}

function buildSeatStats(rounds: RoundRecord[]): Record<Seat, SeatStats> {
  const seats = initialSeatMap();
  for (const entry of rounds) {
    const r = entry.data;
    for (const seat of ALL_SEATS) {
      const hands = r.seats[seat];
      if (!hands) continue;
      for (const hand of hands) {
        if (hand.outcome) updateSeatStats(seats[seat], hand.outcome);
      }
    }
  }
  return seats;
}

export function rebuildDerived(
  state: Pick<BlackjackState, "rounds" | "liveInput">,
  rules: BlackjackRules = DEFAULT_BLACKJACK_RULES,
): Omit<BlackjackState, "rounds" | "liveInput"> {
  const shoe = buildShoeStats(rules, state.rounds, state.liveInput);
  let fiveCard = 0;
  for (const entry of state.rounds) {
    fiveCard += countFiveCard21s(entry.data);
  }

  return {
    roundEvaluation: evaluateLiveInput(state.liveInput, rules),
    cardsSeen: shoe.cardsSeen,
    cardsTotal: shoe.cardsTotal,
    penetrationPct: shoe.penetrationPct,
    penetrationEstimated: shoe.estimated,
    dealer: buildDealerStats(state.rounds),
    seats: buildSeatStats(state.rounds),
    streak: computeStreak(state.rounds),
    fiveCardTwentyOnes: fiveCard,
  };
}

export function initialState(rules: BlackjackRules = DEFAULT_BLACKJACK_RULES): BlackjackState {
  const base = {
    rounds: [] as RoundRecord[],
    liveInput: { dealer: [], seats: {} } as BlackjackLiveInput,
  };
  return { ...base, ...rebuildDerived(base, rules) };
}

export function normalizeResult(result: BlackjackResult, rules: BlackjackRules): BlackjackResult {
  if (result.depth === "full" && result.dealer.cards.length > 0) {
    const seats = resolveRoundSeats(result.seats, result.dealer.cards, rules);
    const validation = validateDealerPlay(result.dealer.cards, rules);
    return {
      ...result,
      seats,
      dealer: {
        ...result.dealer,
        total: validation.total,
        bust: validation.dealerStatus === "bust",
        blackjack: validation.dealerStatus === "blackjack",
      },
    };
  }
  return result;
}
