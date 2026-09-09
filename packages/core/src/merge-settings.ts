import type { TableSettings } from "./settings.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeTableSettings(
  current: TableSettings,
  patch: Partial<TableSettings>,
): TableSettings {
  const next: TableSettings = { ...current, ...patch };

  if (patch.rules !== undefined) {
    const baseRules = isRecord(current.rules) ? current.rules : {};
    const patchRules = isRecord(patch.rules) ? patch.rules : {};
    next.rules = { ...baseRules, ...patchRules };
  }

  return next;
}

export function resolveEffectiveRules<Rules>(fallback: Rules, settingsRules: unknown): Rules {
  if (!isRecord(settingsRules) || Object.keys(settingsRules).length === 0) {
    return fallback;
  }
  return { ...fallback, ...settingsRules } as Rules;
}
