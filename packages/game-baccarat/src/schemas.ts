import { z } from "zod";
import { DEFAULT_BACCARAT_RULES, type BaccaratRules } from "./rules.js";
import { BACCARAT_BET_IDS } from "./bet-target.js";

const rankSchema = z.enum(["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]);
const suitSchema = z.enum(["S", "H", "D", "C"]);
const slotIdSchema = z.enum(["P1", "P2", "P3", "B1", "B2", "B3"]);
const outcomeSchema = z.enum(["P", "B", "T"]);

export const cardSchema = z.object({
  rank: rankSchema,
  suit: suitSchema.nullable(),
});

export const rulesSchema = z.object({
  decks: z.union([z.literal(6), z.literal(8)]),
  bankerCommission: z.union([z.literal(0), z.literal(0.05)]),
  noCommissionBanker6Payout: z.number(),
  tiePayout: z.union([z.literal(8), z.literal(9)]),
  pairPayout: z.number(),
  suitRequired: z.boolean(),
  dragonThreshold: z.number().int().min(4).max(12),
  predictionCells: z.boolean(),
  tieMaxDivisor: z.number().int().positive(),
  burnRule: z.enum(["none", "first_card_value"]),
}) satisfies z.ZodType<BaccaratRules>;

export const resultSchema = z.object({
  cards: z.record(slotIdSchema, cardSchema).nullable(),
  outcome: outcomeSchema,
  playerTotal: z.number().nullable(),
  bankerTotal: z.number().nullable(),
  playerPair: z.boolean(),
  bankerPair: z.boolean(),
  natural: z.boolean(),
});

export const liveInputSchema = z.object({
  slots: z.record(slotIdSchema, cardSchema),
});

export const betTargetSchema = z.enum(BACCARAT_BET_IDS);

export const defaultRules: BaccaratRules = { ...DEFAULT_BACCARAT_RULES };
