import { z } from "zod";

export type AnimationStyle =
  | "none"
  | "flash"
  | "burst"
  | "sweep"
  | "banner"
  | "particles"
  | "trail"
  | "dragon"
  | "shake"
  | "spin"
  | "chips";

export const animationStyleSchema = z.enum([
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
]);

export interface AnimationPreset {
  enabled: boolean;
  style: AnimationStyle;
  durationMs: number;
  intensity: 1 | 2 | 3;
  color?: string;
  text?: string;
  sound?: string | null;
  soundVolume: number;
  blockBoardUpdate: boolean;
}

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

export interface AnimationEventDef {
  id: string;
  label: string;
  defaultPreset: AnimationPreset;
  layered?: boolean;
}

export interface AnimationTrigger {
  eventId: string;
  vars: Record<string, string | number>;
  anchor?: { x: number; y: number };
  path?: { x: number; y: number }[];
}

/** Patch value `null` removes an override key during merge. */
export type AnimationOverridePatch = Record<string, AnimationPreset | null>;
