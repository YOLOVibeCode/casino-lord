import type { AnimationStyle } from "@casino-lord/core";
import { z } from "zod";

// Zod lives here rather than in @casino-lord/core so core stays dependency-free.
// `satisfies` keeps the enum in lockstep with the core AnimationStyle union.
const STYLES = [
  "none",
  "flash",
  "burst",
  "sweep",
  "banner",
  "particles",
  "trail",
  "dragon",
  "shake",
  "spin",
  "chips",
] as const satisfies readonly AnimationStyle[];

export const animationStyleSchema = z.enum(STYLES);

export const animationPresetSchema = z.object({
  enabled: z.boolean(),
  style: animationStyleSchema,
  durationMs: z.number().int().min(200).max(4000),
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  color: z.string().optional(),
  text: z.string().optional(),
  sound: z.string().nullable().optional(),
  soundVolume: z.number().min(0).max(1),
  blockBoardUpdate: z.boolean(),
});

export const animationOverridesSchema = z.record(z.string(), animationPresetSchema);
