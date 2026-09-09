import { z } from "zod";
import { BLACKJACK_BET_IDS } from "./bet-target.js";
import { DEFAULT_BLACKJACK_RULES, type BlackjackRules } from "./rules.js";

const rankSchema = z.enum(["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]);
const suitSchema = z.enum(["S", "H", "D", "C"]);
const seatSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);
const seatOutcomeSchema = z.enum(["win", "lose", "push", "blackjack", "bust", "surrender"]);
const depthSchema = z.enum(["outcomes", "full", "quick"]);

export const cardSchema = z.object({
  rank: rankSchema,
  suit: suitSchema.nullable(),
});

export const handInputSchema = z.object({
  cards: z.array(cardSchema),
  doubled: z.boolean(),
  fromSplit: z.boolean(),
  surrendered: z.boolean(),
  outcome: seatOutcomeSchema.nullable(),
});

export const rulesSchema = z.object({
  decks: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(6), z.literal(8)]),
  seats: z.union([z.literal(5), z.literal(6), z.literal(7)]),
  entryDepth: depthSchema,
  dealerSoft17: z.enum(["stand", "hit"]),
  blackjackPayout: z.enum(["3:2", "6:5", "2:1"]),
  peek: z.boolean(),
  doubleAfterSplit: z.boolean(),
  maxSplits: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  splitAcesOneCard: z.boolean(),
  resplitAces: z.boolean(),
  blackjackAfterSplit: z.boolean(),
  surrender: z.enum(["none", "late", "early"]),
  penetration: z.number().min(0.5).max(0.9),
  roundHoldMs: z.number().int().min(2000).max(15000),
  streakThreshold: z.number().int().min(3).max(10),
  sideBets: z.boolean(),
  trainingOverlay: z.boolean(),
  handsPerPlayer: z.union([z.literal(1), z.literal(2)]),
  doubleForLess: z.boolean(),
  insuranceTimerSec: z.number().int().min(5).max(30),
  autoHitLow: z.boolean(),
  perfectPairsPayout: z.tuple([z.number(), z.number(), z.number()]),
  twentyOnePlusThreePayout: z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]),
}) satisfies z.ZodType<BlackjackRules>;

export const resultSchema = z.object({
  dealer: z.object({
    cards: z.array(cardSchema),
    total: z.number().nullable(),
    bust: z.boolean(),
    blackjack: z.boolean(),
  }),
  seats: z.record(seatSchema, z.array(handInputSchema)),
  depth: depthSchema,
  dealerError: z.boolean(),
});

export const liveInputSchema = z.object({
  dealer: z.array(cardSchema),
  seats: z.record(seatSchema, z.array(handInputSchema)),
  recordDespiteDealerError: z.boolean().optional(),
  virtual: z.any().optional(),
}) as z.ZodType<import("./types.js").BlackjackLiveInput>;

export const betTargetSchema = z.object({
  seat: seatSchema,
  handIndex: z.number().int().min(0).optional(),
}) as z.ZodType<import("./bet-target.js").BlackjackBetTarget>;

export const defaultRules: BlackjackRules = { ...DEFAULT_BLACKJACK_RULES };

export const actionSchema = z.enum(["hit", "stand", "double", "split", "surrender"]);
