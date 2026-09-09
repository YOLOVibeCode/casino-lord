import type { AnimationPreset } from "./animation.js";
import type { TableSettings } from "./settings.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeAnimationOverrides(
  current: Record<string, AnimationPreset> | undefined,
  patch: Record<string, AnimationPreset | null>,
): Record<string, AnimationPreset> {
  const next: Record<string, AnimationPreset> = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return next;
}

export function mergeTableSettings(
  current: TableSettings,
  patch: Partial<TableSettings> & { animations?: Record<string, AnimationPreset | null> },
): TableSettings {
  const next: TableSettings = { ...current, ...patch };

  if (patch.rules !== undefined) {
    const baseRules = isRecord(current.rules) ? current.rules : {};
    const patchRules = isRecord(patch.rules) ? patch.rules : {};
    next.rules = { ...baseRules, ...patchRules };
  }

  if (patch.animations !== undefined) {
    next.animations = mergeAnimationOverrides(current.animations, patch.animations);
  }

  return next;
}

export function resolveEffectiveRules<Rules>(fallback: Rules, settingsRules: unknown): Rules {
  if (!isRecord(settingsRules) || Object.keys(settingsRules).length === 0) {
    return fallback;
  }
  return { ...fallback, ...settingsRules } as Rules;
}
