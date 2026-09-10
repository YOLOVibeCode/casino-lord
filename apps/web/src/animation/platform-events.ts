import type { AnimationEventDef } from "@casino-lord/core";
import type { UntypedGameModule } from "../table/module-types.js";

const platformDefault = (
  label: string,
  style: AnimationEventDef["defaultPreset"]["style"] = "flash",
): AnimationEventDef["defaultPreset"] => ({
  enabled: true,
  style,
  durationMs: 800,
  intensity: 2,
  sound: null,
  soundVolume: 0.5,
  blockBoardUpdate: false,
});

export const PLATFORM_ANIMATION_EVENTS: AnimationEventDef[] = [
  {
    id: "bets_open",
    label: "Bets open",
    defaultPreset: { ...platformDefault("Bets open", "sweep"), text: "BETS OPEN" },
  },
  {
    id: "bets_closed",
    label: "Bets closed",
    defaultPreset: { ...platformDefault("Bets closed", "flash"), text: "BETS CLOSED" },
  },
  {
    id: "big_win",
    label: "Big win",
    defaultPreset: {
      ...platformDefault("Big win", "chips"),
      text: "BIG WIN",
      durationMs: 1500,
      intensity: 3,
    },
  },
  {
    id: "player_bust",
    label: "Player bust",
    defaultPreset: {
      ...platformDefault("Player bust", "shake"),
      text: "BUST",
      durationMs: 1200,
      intensity: 2,
    },
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    defaultPreset: { ...platformDefault("Leaderboard", "banner"), text: "LEADERBOARD" },
  },
  {
    id: "session_end",
    label: "Session end",
    defaultPreset: {
      ...platformDefault("Session end", "sweep"),
      text: "SESSION END",
      durationMs: 1500,
      blockBoardUpdate: true,
    },
  },
];

export type EditorEventScope = "game" | "platform";

export function scopedAnimationKey(eventId: string, scope: EditorEventScope): string {
  return `${scope}.${eventId}`;
}

export function allEditorEvents(
  module: UntypedGameModule,
): Array<AnimationEventDef & { scope: EditorEventScope }> {
  return [
    ...module.animationEvents.map((def) => ({ ...def, scope: "game" as const })),
    ...PLATFORM_ANIMATION_EVENTS.map((def) => ({ ...def, scope: "platform" as const })),
  ];
}

export const PREVIEW_VARS = ["outcome", "streak", "total", "series"] as const;

export function templateVarsForEvent(def: AnimationEventDef): string[] {
  const fromText = def.defaultPreset.text?.match(/\{(\w+)\}/g)?.map((m) => m.slice(1, -1)) ?? [];
  const merged = new Set([...fromText, ...PREVIEW_VARS]);
  return [...merged];
}
