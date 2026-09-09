import type { StatRow } from "@casino-lord/core";
import type { BlackjackRules } from "./rules.js";
import type { BlackjackState } from "./state.js";
import { ALL_SEATS } from "./types.js";

export function blackjackStats(state: BlackjackState, rules: BlackjackRules): StatRow[] {
  const { dealer, seats, streak, rounds } = state;
  const bustPct = dealer.rounds > 0 ? Math.round((dealer.busts / dealer.rounds) * 100) : 0;

  let playerBj = 0;
  let pushes = 0;
  for (const s of ALL_SEATS) {
    playerBj += seats[s].blackjacks;
    pushes += seats[s].pushes;
  }

  const hist = dealer.totalsHistogram;
  const histLabel = `17:${hist[0]} 18:${hist[1]} 19:${hist[2]} 20:${hist[3]} 21:${hist[4]} bust:${hist[5]}`;

  const rows: StatRow[] = [
    { label: "Rounds this shoe", value: rounds.length },
    { label: "Dealer bust %", value: `${bustPct}%` },
    { label: "Dealer blackjack", value: dealer.blackjacks },
    { label: "Player blackjack", value: playerBj },
    { label: "Pushes", value: pushes },
    { label: "Dealer totals", value: histLabel },
    {
      label: "Shoe penetration",
      value: state.penetrationEstimated
        ? `${state.penetrationPct}% (est.)`
        : `${state.penetrationPct}%`,
    },
    { label: "Cards seen", value: `${state.cardsSeen} / ${state.cardsTotal}` },
    { label: "5+ card 21s", value: state.fiveCardTwentyOnes },
  ];

  for (const seat of ALL_SEATS.slice(0, rules.seats)) {
    const s = seats[seat];
    rows.push({
      label: `Seat ${seat}`,
      value: `W${s.wins} L${s.losses} P${s.pushes}`,
    });
  }

  if (streak) {
    rows.push({
      label: "Current streak",
      value: `${streak.side === "dealer" ? "DEALER" : "PLAYERS"} × ${streak.length}`,
    });
  }

  return rows;
}
