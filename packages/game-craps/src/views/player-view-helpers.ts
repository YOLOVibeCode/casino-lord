import type { PlacedBet, PlayerState } from "@casino-lord/core";
import type { BetDef } from "@casino-lord/core";
import { crapsBets } from "../bets.js";
import type { CrapsBetId } from "../bet-target.js";
import type { CrapsBetTarget } from "../bet-target.js";
import { DEFAULT_CRAPS_RULES } from "../rules.js";
import { initialState } from "../state.js";
import type { CrapsRules } from "../rules.js";
import type { CrapsState, Point } from "../types.js";

/** Merge partial platform module snapshots with engine defaults (pre-series join). */
export function normalizeViewState(
  state: CrapsState,
  rules: CrapsRules = DEFAULT_CRAPS_RULES,
): CrapsState {
  const base = initialState(rules);
  return {
    ...base,
    ...state,
    phase: state.phase ?? base.phase,
    point: state.point ?? base.point,
    shooter: state.shooter ?? base.shooter,
    liveInput: state.liveInput ?? base.liveInput,
    table: state.table ?? base.table,
    results: state.results ?? base.results,
    lastRoll: state.lastRoll ?? base.lastRoll,
  };
}

export type PlacePayload = Omit<PlacedBet<CrapsBetTarget>, "id" | "placedAt">;

export function lookupBetDef(
  betId: string,
): BetDef<CrapsRules, CrapsState, CrapsBetTarget> | undefined {
  for (const group of crapsBets.groups) {
    const bet = group.bets.find((b) => b.id === betId);
    if (bet) return bet;
  }
  return undefined;
}

export function betAllowed(betId: string, state: CrapsState, me: PlayerState): true | string {
  const def = lookupBetDef(betId);
  if (!def?.allowedWhen) return true;
  const result = def.allowedWhen(state, { id: me.player.id, bankroll: me.bankroll });
  if (result === true) return true;
  if (typeof result === "string") return result;
  return true;
}

export function defaultWorking(betId: string, rules: CrapsRules, state: CrapsState): boolean {
  const def = lookupBetDef(betId);
  if (!def || def.lifecycle === "round") return false;
  const placeLike = betId === "place" || betId === "buy" || betId === "lay" || betId === "hard";
  if (placeLike && state.phase === "come_out") {
    return rules.placeWorkingOnComeOut;
  }
  return true;
}

export function buildPlacePayload(
  betId: string,
  target: CrapsBetTarget | undefined,
  amount: number,
  me: PlayerState,
  roundId: string,
  rules: CrapsRules,
  state: CrapsState,
): PlacePayload {
  return {
    playerId: me.player.id,
    roundId,
    type: betId,
    ...(target !== undefined ? { target } : {}),
    amount,
    declared: false,
    working: defaultWorking(betId, rules, state),
    originRoundId: roundId,
  };
}

export function isShooter(me: PlayerState, state: CrapsState): boolean {
  return state.currentShooterId === me.player.id;
}

function isPointTarget(target: unknown, point: Point): boolean {
  return (
    typeof target === "object" &&
    target !== null &&
    "kind" in target &&
    (target as CrapsBetTarget).kind === "point" &&
    (target as { kind: "point"; value: Point }).value === point
  );
}

export function travelledComeOnPoint(
  me: PlayerState,
  point: Point,
): PlacedBet<CrapsBetTarget> | undefined {
  return me.openBets.find((b) => b.type === "come" && isPointTarget(b.target, point)) as
    PlacedBet<CrapsBetTarget> | undefined;
}

export function stakeOnPoint(me: PlayerState, point: Point, types: CrapsBetId[]): number {
  return me.openBets
    .filter((b) => types.includes(b.type as CrapsBetId) && isPointTarget(b.target, point))
    .reduce((sum, b) => sum + b.amount, 0);
}

export function findLineBet(
  me: PlayerState,
  type: "pass" | "dont_pass" | "come" | "dont_come",
): PlacedBet<CrapsBetTarget> | undefined {
  return me.openBets.find((b) => b.type === type) as PlacedBet<CrapsBetTarget> | undefined;
}

export function oddsAttachLine(
  me: PlayerState,
): "pass" | "dont_pass" | "come" | "dont_come" | null {
  if (findLineBet(me, "pass")) return "pass";
  if (findLineBet(me, "dont_pass")) return "dont_pass";
  if (findLineBet(me, "come")) return "come";
  if (findLineBet(me, "dont_come")) return "dont_come";
  return null;
}

export function oddsBetIdForLine(line: "pass" | "dont_pass" | "come" | "dont_come"): CrapsBetId {
  if (line === "pass" || line === "come") return "pass_odds";
  return "dont_odds";
}

export function canTakeDown(bet: PlacedBet<CrapsBetTarget>, state: CrapsState): boolean {
  const type = bet.type as CrapsBetId;
  if (type === "pass" || type === "come") {
    return state.phase === "come_out";
  }
  if (type === "dont_pass" || type === "dont_come") return true;
  return type === "place" || type === "buy" || type === "lay" || type === "hard";
}

export const PROP_BET_IDS: CrapsBetId[] = [
  "hard",
  "any_seven",
  "any_craps",
  "two",
  "twelve",
  "three",
  "eleven",
  "horn",
  "horn_high_2",
  "horn_high_3",
  "horn_high_11",
  "horn_high_12",
  "ce",
];

export const SIDE_BET_IDS: CrapsBetId[] = ["fire", "ats_small", "ats_tall", "ats_all"];
