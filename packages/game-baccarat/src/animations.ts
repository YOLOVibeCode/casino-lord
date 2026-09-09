import type { AnimationEventDef, AnimationTrigger, TableEvent } from "@casino-lord/core";
import { getCurrentStreak, outcomeLabel, type StreakInfo } from "./streak.js";
import { resultToRoadHand, type BaccaratState } from "./state.js";
import type { BaccaratResult } from "./types.js";

const APPENDIX_C: Record<string, AnimationEventDef["defaultPreset"] & { color?: string }> = {
  player_win: {
    enabled: true,
    style: "sweep",
    durationMs: 1200,
    intensity: 2,
    text: "PLAYER {total}",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: false,
  },
  banker_win: {
    enabled: true,
    style: "sweep",
    durationMs: 1200,
    intensity: 2,
    text: "BANKER {total}",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: false,
  },
  tie: {
    enabled: true,
    style: "flash",
    durationMs: 1000,
    intensity: 2,
    text: "TIE {total}",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: false,
  },
  player_pair: {
    enabled: true,
    style: "burst",
    durationMs: 700,
    intensity: 1,
    text: "PLAYER PAIR",
    sound: null,
    soundVolume: 0.5,
    blockBoardUpdate: false,
  },
  banker_pair: {
    enabled: true,
    style: "burst",
    durationMs: 700,
    intensity: 1,
    text: "BANKER PAIR",
    sound: null,
    soundVolume: 0.5,
    blockBoardUpdate: false,
  },
  natural: {
    enabled: true,
    style: "banner",
    durationMs: 900,
    intensity: 1,
    text: "NATURAL {total}",
    sound: null,
    soundVolume: 0.5,
    blockBoardUpdate: false,
  },
  dragon: {
    enabled: true,
    style: "dragon",
    durationMs: 2500,
    intensity: 3,
    text: "{outcome} DRAGON × {streak}",
    sound: null,
    soundVolume: 0.8,
    blockBoardUpdate: true,
  },
  dragon_broken: {
    enabled: false,
    style: "flash",
    durationMs: 600,
    intensity: 1,
    text: "",
    sound: null,
    soundVolume: 0.5,
    blockBoardUpdate: false,
  },
  shoe_start: {
    enabled: true,
    style: "sweep",
    durationMs: 1500,
    intensity: 2,
    text: "NEW SHOE {series}",
    color: "#D4AF37",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: true,
  },
  hand_undone: {
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

const LAYERED = new Set(["player_pair", "banker_pair", "natural"]);

export const baccaratAnimationEvents: AnimationEventDef[] = Object.entries(APPENDIX_C).map(
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

function outcomeEventId(outcome: BaccaratResult["outcome"]): string {
  switch (outcome) {
    case "P":
      return "player_win";
    case "B":
      return "banker_win";
    case "T":
      return "tie";
  }
}

function winningTotal(result: BaccaratResult): number {
  switch (result.outcome) {
    case "P":
      return result.playerTotal ?? 0;
    case "B":
      return result.bankerTotal ?? 0;
    case "T":
      return result.playerTotal ?? result.bankerTotal ?? 0;
  }
}

function shouldFireDragon(
  prev: StreakInfo | null,
  next: StreakInfo | null,
  threshold: number,
): boolean {
  if (!next || next.length < threshold) return false;
  if (!prev || prev.length < threshold) return true;
  if (next.length <= prev.length) return false;
  const prevFire = prev.length >= threshold ? Math.floor((prev.length - threshold) / 2) : -1;
  const nextFire = Math.floor((next.length - threshold) / 2);
  return nextFire > prevFire;
}

function dragonIntensity(streak: number, threshold: number): number {
  const extra = Math.floor((streak - threshold) / 2);
  return Math.min(3, 2 + extra) as 1 | 2 | 3;
}

function streakBroken(
  prev: StreakInfo | null,
  next: StreakInfo | null,
  threshold: number,
): boolean {
  if (!prev || prev.length < threshold) return false;
  if (!next) return true;
  return next.side !== prev.side || next.length < prev.length;
}

export function deriveBaccaratAnimations(
  prev: BaccaratState,
  next: BaccaratState,
  event: TableEvent,
): AnimationTrigger[] {
  const threshold = next.dragonThreshold;
  const triggers: AnimationTrigger[] = [];

  if (event.type === "SERIES_STARTED") {
    triggers.push({
      eventId: "shoe_start",
      vars: { series: event.seriesId },
    });
    return triggers;
  }

  if (event.type === "RESULT_UNDONE") {
    triggers.push({ eventId: "hand_undone", vars: {} });
    if (streakBroken(prev.currentStreak, next.currentStreak, threshold)) {
      triggers.push({ eventId: "dragon_broken", vars: {} });
    }
    return triggers;
  }

  if (event.type === "RESULT_RECORDED") {
    const result = event.result.data as BaccaratResult;
    const total = winningTotal(result);

    triggers.push({
      eventId: outcomeEventId(result.outcome),
      vars: { total },
    });

    if (result.playerPair) {
      triggers.push({ eventId: "player_pair", vars: {} });
    }
    if (result.bankerPair) {
      triggers.push({ eventId: "banker_pair", vars: {} });
    }
    if (result.natural) {
      triggers.push({ eventId: "natural", vars: { total } });
    }

    const prevHands = prev.results.map((r) => resultToRoadHand(r.data));
    const nextHands = next.results.map((r) => resultToRoadHand(r.data));
    const prevStreak = getCurrentStreak(prevHands);
    const nextStreak = getCurrentStreak(nextHands);

    if (streakBroken(prevStreak, nextStreak, threshold)) {
      triggers.push({ eventId: "dragon_broken", vars: {} });
    }

    if (shouldFireDragon(prevStreak, nextStreak, threshold) && nextStreak) {
      triggers.push({
        eventId: "dragon",
        vars: {
          outcome: outcomeLabel(nextStreak.side),
          streak: nextStreak.length,
          total,
          intensity: dragonIntensity(nextStreak.length, threshold),
        },
        path: nextStreak.path,
      });
    }

    return triggers;
  }

  return triggers;
}
