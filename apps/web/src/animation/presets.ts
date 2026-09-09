import type { AnimationEventDef, AnimationPreset, TableSettings } from "@casino-lord/core";
import type { UntypedGameModule } from "../table/module-types.js";
import { PLATFORM_ANIMATION_EVENTS } from "./platform-events.js";

export function buildEventDefMap(events: AnimationEventDef[]): Map<string, AnimationEventDef> {
  return new Map(events.map((def) => [def.id, def]));
}

export function resolvePreset(
  eventId: string,
  module: UntypedGameModule,
  tableSettings: TableSettings | unknown,
): AnimationPreset {
  const def =
    module.animationEvents.find((e) => e.id === eventId) ??
    PLATFORM_ANIMATION_EVENTS.find((e) => e.id === eventId);
  const base = def?.defaultPreset ?? {
    enabled: false,
    style: "none" as const,
    durationMs: 0,
    intensity: 1 as const,
    sound: null,
    soundVolume: 0,
    blockBoardUpdate: false,
  };

  const overrides = (tableSettings as TableSettings | undefined)?.animations;
  if (!overrides) return { ...base };

  const gameKey = `game.${eventId}`;
  const platformKey = `platform.${eventId}`;
  const override = overrides[gameKey] ?? overrides[platformKey] ?? overrides[eventId];
  if (!override) return { ...base };

  return { ...base, ...override };
}

export function enrichAnimationVars(
  eventId: string,
  vars: Record<string, string | number>,
): Record<string, string | number> {
  if (vars.outcome !== undefined) return vars;
  switch (eventId) {
    case "player_win":
      return { ...vars, outcome: "PLAYER" };
    case "banker_win":
      return { ...vars, outcome: "BANKER" };
    case "tie":
      return { ...vars, outcome: "TIE" };
    default:
      return vars;
  }
}

export function substituteBannerText(
  template: string | undefined,
  vars: Record<string, string | number>,
): string {
  if (!template) return "";
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    return value === undefined ? "" : String(value);
  });
}

export function semanticColor(eventId: string, vars: Record<string, string | number>): string {
  if (eventId === "player_win" || vars.outcome === "PLAYER") return "#2F6FE4";
  if (eventId === "banker_win" || vars.outcome === "BANKER") return "#E5322D";
  if (eventId === "tie" || vars.outcome === "TIE") return "#2BB673";
  if (eventId === "shoe_start" || eventId === "hand_undone") return "#D4AF37";
  return "#D4AF37";
}

export function effectiveColor(
  preset: AnimationPreset,
  eventId: string,
  vars: Record<string, string | number>,
): string {
  return preset.color ?? semanticColor(eventId, vars);
}

export function getEffectivePreset(
  eventId: string,
  module: UntypedGameModule,
  settings: TableSettings,
): AnimationPreset {
  return resolvePreset(eventId, module, settings);
}
