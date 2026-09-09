import { evaluateHand } from "./engine.js";
import { buildRoads, type BuiltRoads } from "./roads/index.js";
import { DEFAULT_BACCARAT_RULES, type BaccaratRules } from "./rules.js";
import { ShoeTracker } from "./shoe-tracker.js";
import { getCurrentStreak, longestStreak, type StreakInfo } from "./streak.js";
import type { BaccaratResult, Card, HandState, RoadHand, SlotId } from "./types.js";

export interface BaccaratResultEntry {
  id: string;
  data: BaccaratResult;
}

export interface BaccaratState {
  results: BaccaratResultEntry[];
  liveSlots: Partial<Record<SlotId, Card>>;
  handState: HandState;
  roads: BuiltRoads;
  cardsSeen: number;
  hasCardData: boolean;
  currentStreak: StreakInfo | null;
  longestStreak: StreakInfo | null;
  dragonThreshold: number;
}

export function resultToRoadHand(result: BaccaratResult): RoadHand {
  return {
    outcome: result.outcome,
    playerPair: result.playerPair,
    bankerPair: result.bankerPair,
  };
}

function countCardsInSlots(slots: Partial<Record<SlotId, Card>>): number {
  return Object.values(slots).filter(Boolean).length;
}

function buildShoeTracker(
  rules: BaccaratRules,
  results: BaccaratResultEntry[],
  liveSlots: Partial<Record<SlotId, Card>>,
): { tracker: ShoeTracker; cardsSeen: number; hasCardData: boolean } {
  const tracker = new ShoeTracker(rules);
  let hasCardData = false;

  for (const entry of results) {
    if (entry.data.cards) {
      hasCardData = true;
      tracker.addFromSlots(entry.data.cards);
    }
  }

  if (Object.keys(liveSlots).length > 0) {
    hasCardData = true;
    tracker.addFromSlots(liveSlots);
  }

  return { tracker, cardsSeen: tracker.seenCount, hasCardData };
}

export function rebuildDerived(
  state: Pick<BaccaratState, "results" | "liveSlots">,
  rules: BaccaratRules = DEFAULT_BACCARAT_RULES,
): Pick<
  BaccaratState,
  | "handState"
  | "roads"
  | "cardsSeen"
  | "hasCardData"
  | "currentStreak"
  | "longestStreak"
  | "dragonThreshold"
> {
  const roadHands = state.results.map((r) => resultToRoadHand(r.data));
  const roads = buildRoads(roadHands, rules);
  const { tracker, cardsSeen, hasCardData } = buildShoeTracker(
    rules,
    state.results,
    state.liveSlots,
  );
  const handState = evaluateHand(state.liveSlots, rules, { shoeTracker: tracker });

  return {
    handState,
    roads,
    cardsSeen,
    hasCardData,
    currentStreak: getCurrentStreak(roadHands),
    longestStreak: longestStreak(roadHands),
    dragonThreshold: rules.dragonThreshold,
  };
}

export function initialState(rules: BaccaratRules = DEFAULT_BACCARAT_RULES): BaccaratState {
  const base = { results: [], liveSlots: {} };
  const derived = rebuildDerived(base, rules);
  return { ...base, ...derived };
}

export function estimatedHandsRemaining(
  rules: BaccaratRules,
  cardsSeen: number,
  hasCardData: boolean,
  results: BaccaratResultEntry[],
): number | null {
  if (!hasCardData) return null;

  const maxCards = rules.decks * 52;
  const remaining = maxCards - cardsSeen;
  if (remaining <= 0) return 0;

  let cardedHands = 0;
  let totalCards = 0;
  for (const entry of results) {
    if (entry.data.cards) {
      cardedHands++;
      totalCards += countCardsInSlots(entry.data.cards);
    }
  }

  const avg = cardedHands > 0 ? totalCards / cardedHands : 4.5;
  return Math.floor(remaining / avg);
}
