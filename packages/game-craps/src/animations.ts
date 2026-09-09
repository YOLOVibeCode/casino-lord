import type { AnimationEventDef, AnimationTrigger, TableEvent } from "@casino-lord/core";
import type { CrapsState } from "./types.js";

const APPENDIX_C: Record<string, AnimationEventDef["defaultPreset"] & { color?: string }> = {
  point_established: {
    enabled: true,
    style: "spin",
    durationMs: 1200,
    intensity: 1,
    text: "POINT {point}",
    color: "#EDE6D6",
    sound: null,
    soundVolume: 0.5,
    blockBoardUpdate: true,
  },
  point_made: {
    enabled: true,
    style: "burst",
    durationMs: 1800,
    intensity: 3,
    text: "{point} — POINT MADE",
    color: "#D4AF37",
    sound: null,
    soundVolume: 0.8,
    blockBoardUpdate: true,
  },
  natural: {
    enabled: true,
    style: "banner",
    durationMs: 1200,
    intensity: 2,
    text: "{total} — WINNER",
    color: "#D4AF37",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: false,
  },
  craps: {
    enabled: true,
    style: "flash",
    durationMs: 900,
    intensity: 2,
    text: "{total} — CRAPS",
    color: "#E08A1E",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: false,
  },
  seven_out: {
    enabled: true,
    style: "shake",
    durationMs: 2000,
    intensity: 3,
    text: "SEVEN OUT",
    color: "#D7263D",
    sound: null,
    soundVolume: 0.8,
    blockBoardUpdate: true,
  },
  hard_way: {
    enabled: true,
    style: "burst",
    durationMs: 800,
    intensity: 2,
    text: "HARD {total}",
    color: "#8E5BD9",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: false,
  },
  neutral: {
    enabled: true,
    style: "spin",
    durationMs: 800,
    intensity: 1,
    text: "",
    color: "#EDE6D6",
    sound: null,
    soundVolume: 0.3,
    blockBoardUpdate: false,
  },
  hot_shooter: {
    enabled: true,
    style: "trail",
    durationMs: 2000,
    intensity: 2,
    text: "HOT SHOOTER · {rolls} ROLLS",
    color: "#D4AF37",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: false,
  },
  fire_progress: {
    enabled: true,
    style: "particles",
    durationMs: 1500,
    intensity: 2,
    text: "FIRE · {points} POINTS",
    color: "#FF6A00",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: false,
  },
  shooter_start: {
    enabled: true,
    style: "sweep",
    durationMs: 1200,
    intensity: 2,
    text: "NEW SHOOTER",
    color: "#D4AF37",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: true,
  },
  roll_undone: {
    enabled: true,
    style: "flash",
    durationMs: 400,
    intensity: 1,
    text: "ROLL UNDONE",
    color: "#D4AF37",
    sound: null,
    soundVolume: 0.4,
    blockBoardUpdate: false,
  },
};

export const crapsAnimationEvents: AnimationEventDef[] = Object.entries(APPENDIX_C).map(
  ([id, preset]) => ({
    id,
    label: id.replace(/_/g, " "),
    defaultPreset: preset,
    layered: ["hard_way", "hot_shooter", "fire_progress"].includes(id),
  }),
);

export function deriveCrapsAnimations(
  prev: CrapsState,
  next: CrapsState,
  event: TableEvent,
): AnimationTrigger[] {
  const triggers: AnimationTrigger[] = [];

  if (event.type === "SERIES_STARTED") {
    triggers.push({ eventId: "shooter_start", vars: {} });
    return triggers;
  }

  if (event.type === "RESULT_UNDONE") {
    triggers.push({ eventId: "roll_undone", vars: {} });
    return triggers;
  }

  if (event.type !== "RESULT_RECORDED" || !next.lastRoll) {
    return triggers;
  }

  const roll = next.lastRoll;
  const { info, total } = roll;

  triggers.push({ eventId: "neutral", vars: { total } });

  switch (info.decision) {
    case "natural":
      triggers.push({ eventId: "natural", vars: { total } });
      break;
    case "craps":
      triggers.push({ eventId: "craps", vars: { total } });
      break;
    case "point_established":
      triggers.push({ eventId: "point_established", vars: { point: total } });
      break;
    case "point_made":
      triggers.push({ eventId: "point_made", vars: { point: info.pointBefore ?? total } });
      break;
    case "seven_out":
      triggers.push({ eventId: "seven_out", vars: { total } });
      break;
    default:
      break;
  }

  if (roll.hard === true) {
    triggers.push({ eventId: "hard_way", vars: { total } });
  }

  const threshold = 20;
  const prevRolls = prev.shooter.rollCount;
  const nextRolls = next.shooter.rollCount;
  if (nextRolls >= threshold && (prevRolls < threshold || (nextRolls - threshold) % 10 === 0)) {
    triggers.push({ eventId: "hot_shooter", vars: { rolls: nextRolls } });
  }

  const prevDistinct = prev.shooter.distinctPointsMade.length;
  const nextDistinct = next.shooter.distinctPointsMade.length;
  if (nextDistinct > prevDistinct && [4, 5, 6].includes(nextDistinct)) {
    triggers.push({ eventId: "fire_progress", vars: { points: nextDistinct } });
  }

  return triggers;
}
