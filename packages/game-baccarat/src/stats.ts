import type { StatRow } from "@casino-lord/core";
import type { BaccaratRules } from "./rules.js";
import { estimatedHandsRemaining, resultToRoadHand, type BaccaratState } from "./state.js";
import { outcomeLabel, streakLabel } from "./streak.js";

export function baccaratStats(state: BaccaratState, rules: BaccaratRules): StatRow[] {
  const hands = state.results.map((r) => r.data);
  let p = 0;
  let b = 0;
  let t = 0;
  let playerPairs = 0;
  let bankerPairs = 0;
  let naturals = 0;

  for (const h of hands) {
    if (h.outcome === "P") p++;
    else if (h.outcome === "B") b++;
    else t++;
    if (h.playerPair) playerPairs++;
    if (h.bankerPair) bankerPairs++;
    if (h.natural) naturals++;
  }

  const nonTie = p + b;
  const pPct = nonTie > 0 ? Math.round((p / nonTie) * 100) : 0;
  const bPct = nonTie > 0 ? Math.round((b / nonTie) * 100) : 0;

  const rows: StatRow[] = [
    { label: "Player", value: p },
    { label: "Banker", value: b },
    { label: "Tie", value: t },
    { label: "Player %", value: `${pPct}%` },
    { label: "Banker %", value: `${bPct}%` },
    { label: "Player pairs", value: playerPairs },
    { label: "Banker pairs", value: bankerPairs },
    { label: "Naturals", value: naturals },
    { label: "Current streak", value: streakLabel(state.currentStreak) },
    {
      label: "Longest streak",
      value: state.longestStreak
        ? `${outcomeLabel(state.longestStreak.side)} × ${state.longestStreak.length}`
        : "—",
    },
    { label: "Hands this shoe", value: hands.length },
  ];

  const remaining = estimatedHandsRemaining(
    rules,
    state.cardsSeen,
    state.hasCardData,
    state.results,
  );
  if (remaining !== null) {
    rows.push({ label: "Est. hands remaining", value: remaining });
  }

  return rows;
}
