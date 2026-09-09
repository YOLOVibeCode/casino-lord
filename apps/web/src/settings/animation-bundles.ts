import type { AnimationPreset, GameId } from "@casino-lord/core";
import { browserStorage, type StorageLike } from "./storage.js";
import type { UntypedGameModule } from "../table/module-types.js";
import { scopedAnimationKey } from "../animation/platform-events.js";

export interface AnimationBundle {
  name: string;
  overrides: Record<string, AnimationPreset>;
}

const STORAGE_PREFIX = "casino-lord:animation-bundles:";

function storageKey(gameId: GameId): string {
  return `${STORAGE_PREFIX}${gameId}`;
}

function quietPreset(): AnimationPreset {
  return {
    enabled: true,
    style: "flash",
    durationMs: 400,
    intensity: 1,
    sound: null,
    soundVolume: 0.4,
    blockBoardUpdate: false,
  };
}

function quietOverridesForModule(module: UntypedGameModule): Record<string, AnimationPreset> {
  const overrides: Record<string, AnimationPreset> = {};
  for (const def of module.animationEvents) {
    overrides[scopedAnimationKey(def.id, "game")] = quietPreset();
  }
  return overrides;
}

export const BUILTIN_BUNDLE_IDS = {
  casinoFloor: "__builtin:casino-floor",
  quiet: "__builtin:quiet",
  resetAll: "__builtin:reset-all",
} as const;

export function listBuiltinBundles(gameId: GameId, module: UntypedGameModule): AnimationBundle[] {
  if (gameId !== "baccarat") return [];
  return [
    { name: "Casino floor", overrides: {} },
    { name: "Quiet", overrides: quietOverridesForModule(module) },
  ];
}

export function listSavedBundles(
  gameId: GameId,
  store: StorageLike | null = browserStorage(),
): AnimationBundle[] {
  if (!store) return [];
  try {
    const raw = store.getItem(storageKey(gameId));
    if (!raw) return [];
    return JSON.parse(raw) as AnimationBundle[];
  } catch {
    return [];
  }
}

export function saveBundle(
  gameId: GameId,
  name: string,
  overrides: Record<string, AnimationPreset>,
  store: StorageLike | null = browserStorage(),
): void {
  if (!store) return;
  const bundles = listSavedBundles(gameId, store).filter((b) => b.name !== name);
  bundles.push({ name, overrides });
  store.setItem(storageKey(gameId), JSON.stringify(bundles));
}

export function buildResetAllPatch(
  module: UntypedGameModule,
  current: Record<string, AnimationPreset> | undefined,
): Record<string, null> {
  const patch: Record<string, null> = {};
  for (const def of module.animationEvents) {
    patch[scopedAnimationKey(def.id, "game")] = null;
  }
  if (current) {
    for (const key of Object.keys(current)) {
      if (key.startsWith("game.")) patch[key] = null;
    }
  }
  return patch;
}

export function buildBundleLoadPatch(
  bundleId: string,
  gameId: GameId,
  module: UntypedGameModule,
  current: Record<string, AnimationPreset> | undefined,
  store: StorageLike | null = browserStorage(),
): Record<string, AnimationPreset | null> {
  if (bundleId === BUILTIN_BUNDLE_IDS.resetAll) {
    return buildResetAllPatch(module, current);
  }

  if (bundleId === BUILTIN_BUNDLE_IDS.casinoFloor) {
    return buildResetAllPatch(module, current);
  }

  if (bundleId === BUILTIN_BUNDLE_IDS.quiet && gameId === "baccarat") {
    return { ...buildResetAllPatch(module, current), ...quietOverridesForModule(module) };
  }

  const saved = listSavedBundles(gameId, store).find((b) => b.name === bundleId);
  if (!saved) return {};
  return { ...buildResetAllPatch(module, current), ...saved.overrides };
}

export function collectGameOverrides(
  settings: Record<string, AnimationPreset> | undefined,
  module: UntypedGameModule,
): Record<string, AnimationPreset> {
  if (!settings) return {};
  const ids = new Set(module.animationEvents.map((d) => scopedAnimationKey(d.id, "game")));
  const out: Record<string, AnimationPreset> = {};
  for (const [key, preset] of Object.entries(settings)) {
    if (ids.has(key)) out[key] = preset;
  }
  return out;
}
