import type { AnimationEventDef, AnimationPreset } from "@casino-lord/core";
import type { UntypedGameModule } from "../table/module-types.js";

export interface TableAnimationSettings {
  animations?: Record<string, AnimationPreset>;
}

export function buildEventDefMap(events: AnimationEventDef[]): Map<string, AnimationEventDef> {
  return new Map(events.map((def) => [def.id, def]));
}

export function resolvePreset(
  eventId: string,
  module: UntypedGameModule,
  tableSettings: unknown,
): AnimationPreset {
  const def = module.animationEvents.find((e) => e.id === eventId);
  const base = def?.defaultPreset ?? {
    enabled: false,
    style: "none" as const,
    durationMs: 0,
    intensity: 1 as const,
    sound: null,
    soundVolume: 0,
    blockBoardUpdate: false,
  };

  const overrides = (tableSettings as TableAnimationSettings | undefined)?.animations;
  if (!overrides) return { ...base };

  const gameKey = `game.${eventId}`;
  const platformKey = `platform.${eventId}`;
  const override = overrides[gameKey] ?? overrides[platformKey] ?? overrides[eventId];
  if (!override) return { ...base };

  return { ...base, ...override };
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
