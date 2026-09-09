import { z } from "zod";
import { CRAPS_BET_IDS } from "./bet-target.js";
import type { CrapsBetTarget } from "./bet-target.js";
import type { CrapsLiveInput, CrapsResult } from "./types.js";
import { DEFAULT_CRAPS_RULES, type CrapsRules } from "./rules.js";

const faceSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const pointSchema = z.union([
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(8),
  z.literal(9),
  z.literal(10),
]);

export const resultSchema = z.object({
  a: faceSchema.nullable(),
  b: faceSchema.nullable(),
  total: z.number().int().min(2).max(12),
  hard: z.boolean().nullable(),
}) satisfies z.ZodType<CrapsResult>;

export const liveInputSchema = z.object({
  a: faceSchema.nullable(),
  b: faceSchema.nullable(),
}) satisfies z.ZodType<CrapsLiveInput>;

export const betTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("point"), value: pointSchema }),
  z.object({
    kind: z.literal("attach"),
    line: z.enum(["pass", "come", "dont_pass", "dont_come"]),
  }),
  z.object({ kind: z.literal("parent"), betId: z.string() }),
]) satisfies z.ZodType<CrapsBetTarget>;

export const rulesSchema = z.object({
  maxOdds: z.enum(["1x", "2x", "3x", "3-4-5x", "5x", "10x", "20x", "100x"]),
  field12: z.union([z.literal(2), z.literal(3)]),
  field2: z.union([z.literal(2), z.literal(3)]),
  buyVigOnWin: z.boolean(),
  fire4: z.number(),
  fire5: z.number(),
  fire6: z.number(),
  trackFire: z.boolean(),
  trackAllTallSmall: z.boolean(),
  hotShooterThreshold: z.number().int().min(10).max(50),
  distributionWindow: z.enum(["shooter", "table"]),
  autoNewShooterOnSevenOut: z.boolean(),
  showLiveDice: z.boolean(),
  barNumber: z.union([z.literal(2), z.literal(12)]),
  putBets: z.boolean(),
  placeWorkingOnComeOut: z.boolean(),
  shooterMustBetLine: z.boolean(),
  shooterIdleSec: z.number(),
  hornHigh: z.boolean(),
}) satisfies z.ZodType<CrapsRules>;

export const defaultRules = DEFAULT_CRAPS_RULES;

export const crapsBetIdSchema = z.enum(CRAPS_BET_IDS);
