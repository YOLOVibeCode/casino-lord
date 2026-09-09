import type { AnimationEventDef, AnimationTrigger, TableEvent } from "@casino-lord/core";
import type { RouletteRules } from "./rules.js";
import type { RouletteState } from "./state.js";
import type { Color, RouletteResult } from "./types.js";

const APPENDIX_B: Record<string, AnimationEventDef["defaultPreset"] & { color?: string }> = {
  red_win: {
    enabled: true,
    style: "spin",
    durationMs: 1800,
    intensity: 2,
    text: "{pocket} RED",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: true,
  },
  black_win: {
    enabled: true,
    style: "spin",
    durationMs: 1800,
    intensity: 2,
    text: "{pocket} BLACK",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: true,
  },
  zero_hit: {
    enabled: true,
    style: "burst",
    durationMs: 1600,
    intensity: 3,
    text: "{pocket} GREEN",
    sound: null,
    soundVolume: 0.7,
    blockBoardUpdate: true,
  },
  repeat: {
    enabled: true,
    style: "banner",
    durationMs: 1000,
    intensity: 2,
    text: "{pocket} AGAIN × {count}",
    color: "#D4AF37",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: false,
  },
  color_streak: {
    enabled: true,
    style: "sweep",
    durationMs: 1200,
    intensity: 2,
    text: "{color} × {streak}",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: false,
  },
  hot_number: {
    enabled: false,
    style: "flash",
    durationMs: 600,
    intensity: 1,
    text: "HOT {pocket}",
    color: "#D4AF37",
    sound: null,
    soundVolume: 0.5,
    blockBoardUpdate: false,
  },
  no_spin: {
    enabled: true,
    style: "flash",
    durationMs: 500,
    intensity: 1,
    text: "NO SPIN",
    color: "#888888",
    sound: null,
    soundVolume: 0.4,
    blockBoardUpdate: false,
  },
  session_start: {
    enabled: true,
    style: "sweep",
    durationMs: 1500,
    intensity: 2,
    text: "NEW SESSION",
    color: "#D4AF37",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: true,
  },
  spin_undone: {
    enabled: true,
    style: "flash",
    durationMs: 400,
    intensity: 1,
    text: "",
    color: "#D4AF37",
    sound: null,
    soundVolume: 0.4,
    blockBoardUpdate: false,
  },
};

const LAYERED = new Set(["repeat", "color_streak", "hot_number"]);

export const rouletteAnimationEvents: AnimationEventDef[] = Object.entries(APPENDIX_B).map(
  ([id, preset]) => {
    const defaultPreset: AnimationEventDef["defaultPreset"] = {
      enabled: preset.enabled,
      style: preset.style,
      durationMs: preset.durationMs,
      intensity: preset.intensity,
      sound: preset.sound ?? null,
      soundVolume: preset.soundVolume,
      blockBoardUpdate: preset.blockBoardUpdate,
    };
    if (preset.text !== undefined) defaultPreset.text = preset.text;
    if (preset.color !== undefined) defaultPreset.color = preset.color;
    return {
      id,
      label: id.replace(/_/g, " "),
      defaultPreset,
      ...(LAYERED.has(id) ? { layered: true as const } : {}),
    };
  },
);

function colorEventId(color: Color): string {
  if (color === "red") return "red_win";
  if (color === "black") return "black_win";
  return "zero_hit";
}

function shouldFireColorStreak(prevLen: number, nextLen: number, threshold: number): boolean {
  if (nextLen < threshold) return false;
  if (prevLen < threshold) return true;
  const prevFire = Math.floor((prevLen - threshold) / 2);
  const nextFire = Math.floor((nextLen - threshold) / 2);
  return nextFire > prevFire;
}

export function deriveRouletteAnimations(
  prev: RouletteState,
  next: RouletteState,
  event: TableEvent,
  rules: RouletteRules,
): AnimationTrigger[] {
  const triggers: AnimationTrigger[] = [];

  if (event.type === "SERIES_STARTED") {
    triggers.push({ eventId: "session_start", vars: {} });
    return triggers;
  }

  if (event.type === "RESULT_UNDONE") {
    triggers.push({ eventId: "spin_undone", vars: {} });
    return triggers;
  }

  if (event.type === "RESULT_RECORDED") {
    const result = event.result.data as RouletteResult;
    if (result.pocket === null) {
      triggers.push({ eventId: "no_spin", vars: {} });
      return triggers;
    }

    const info = next.lastSpin?.info;
    if (!info) return triggers;

    triggers.push({
      eventId: colorEventId(info.color),
      vars: { pocket: String(result.pocket) },
    });

    if (next.repeats >= 1) {
      triggers.push({
        eventId: "repeat",
        vars: { pocket: String(result.pocket), count: next.repeats + 1 },
      });
    }

    const prevColorLen = prev.streaks.color?.length ?? 0;
    const nextColorLen = next.streaks.color?.length ?? 0;
    if (
      next.streaks.color &&
      shouldFireColorStreak(prevColorLen, nextColorLen, rules.streakThreshold)
    ) {
      triggers.push({
        eventId: "color_streak",
        vars: { color: next.streaks.color.value.toUpperCase(), streak: nextColorLen },
      });
    }

    if (next.hot[0] === result.pocket) {
      triggers.push({ eventId: "hot_number", vars: { pocket: String(result.pocket) } });
    }

    return triggers;
  }

  return triggers;
}
