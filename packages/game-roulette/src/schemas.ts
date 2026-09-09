import { z } from "zod";
import { DEFAULT_ROULETTE_RULES, type RouletteRules } from "./rules.js";

const pocketSchema = z.union([z.literal(0), z.literal("00"), z.number().int().min(1).max(36)]);

export const rulesSchema = z.object({
  wheel: z.enum(["european", "american", "french"]),
  zeroRule: z.enum(["none", "la_partage", "en_prison"]),
  historyLength: z.number().int().min(10).max(40),
  statsWindow: z.union([z.literal("session"), z.literal(50), z.literal(100), z.literal(200)]),
  streakThreshold: z.number().int().min(4).max(12),
  zeroInDenominator: z.boolean(),
  showSectors: z.boolean(),
  sectorHeat: z.boolean(),
  autoConfirm: z.boolean(),
  insideMax: z.number().int().min(0),
  doublePrison: z.boolean(),
  allowCallBets: z.boolean(),
}) satisfies z.ZodType<RouletteRules>;

export const resultSchema = z.object({
  pocket: pocketSchema.nullable(),
});

export const liveInputSchema = z.object({
  pending: pocketSchema.nullable(),
  spinning: z.boolean().optional(),
});

const betTargetSchemaInner = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("straight"), pocket: pocketSchema }),
  z.object({ kind: z.literal("split"), pockets: z.tuple([pocketSchema, pocketSchema]) }),
  z.object({ kind: z.literal("street"), pockets: z.array(pocketSchema) }),
  z.object({ kind: z.literal("corner"), pockets: z.array(pocketSchema) }),
  z.object({ kind: z.literal("six_line"), pockets: z.array(pocketSchema) }),
  z.object({ kind: z.literal("basket") }),
  z.object({ kind: z.literal("top_line") }),
  z.object({ kind: z.literal("dozen"), n: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  z.object({ kind: z.literal("column"), n: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  z.object({ kind: z.literal("red") }),
  z.object({ kind: z.literal("black") }),
  z.object({ kind: z.literal("odd") }),
  z.object({ kind: z.literal("even") }),
  z.object({ kind: z.literal("low") }),
  z.object({ kind: z.literal("high") }),
  z.object({ kind: z.literal("voisins") }),
  z.object({ kind: z.literal("tiers") }),
  z.object({ kind: z.literal("orphelins") }),
  z.object({ kind: z.literal("jeu_zero") }),
  z.object({ kind: z.literal("neighbours"), pocket: pocketSchema }),
]);

export const betTargetSchema = betTargetSchemaInner;

export const defaultRules: RouletteRules = { ...DEFAULT_ROULETTE_RULES };
