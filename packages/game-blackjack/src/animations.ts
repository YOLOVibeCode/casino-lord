import type { AnimationEventDef, AnimationTrigger, TableEvent } from "@casino-lord/core";
import type { BlackjackState } from "./state.js";
import type { BlackjackResult, Seat } from "./types.js";
import { ALL_SEATS } from "./types.js";

const APPENDIX_B: Record<string, AnimationEventDef["defaultPreset"] & { color?: string }> = {
  dealer_bust: {
    enabled: true,
    style: "shake",
    durationMs: 1400,
    intensity: 3,
    text: "DEALER BUSTS {total}",
    color: "#E08A1E",
    sound: null,
    soundVolume: 0.8,
    blockBoardUpdate: true,
  },
  dealer_blackjack: {
    enabled: true,
    style: "banner",
    durationMs: 1400,
    intensity: 2,
    text: "DEALER BLACKJACK",
    color: "#D7263D",
    sound: null,
    soundVolume: 0.7,
    blockBoardUpdate: true,
  },
  dealer_stand: {
    enabled: true,
    style: "flash",
    durationMs: 700,
    intensity: 1,
    text: "DEALER {total}",
    color: "#EDE6D6",
    sound: null,
    soundVolume: 0.4,
    blockBoardUpdate: false,
  },
  player_blackjack: {
    enabled: true,
    style: "burst",
    durationMs: 1200,
    intensity: 3,
    text: "BLACKJACK · SEAT {seat}",
    color: "#D4AF37",
    sound: null,
    soundVolume: 0.7,
    blockBoardUpdate: false,
  },
  table_sweep: {
    enabled: true,
    style: "sweep",
    durationMs: 1200,
    intensity: 2,
    text: "HOUSE SWEEPS",
    color: "#D7263D",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: false,
  },
  table_win: {
    enabled: true,
    style: "particles",
    durationMs: 1600,
    intensity: 3,
    text: "TABLE WINS",
    color: "#2BB673",
    sound: null,
    soundVolume: 0.7,
    blockBoardUpdate: false,
  },
  five_card_21: {
    enabled: true,
    style: "burst",
    durationMs: 900,
    intensity: 2,
    text: "{cards}-CARD 21",
    color: "#D4AF37",
    sound: null,
    soundVolume: 0.6,
    blockBoardUpdate: false,
  },
  dealer_streak: {
    enabled: false,
    style: "flash",
    durationMs: 800,
    intensity: 2,
    text: "DEALER × {streak}",
    color: "#D7263D",
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
  round_undone: {
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

const LAYERED = new Set([
  "player_blackjack",
  "table_sweep",
  "table_win",
  "five_card_21",
  "dealer_streak",
]);

export const blackjackAnimationEvents: AnimationEventDef[] = Object.entries(APPENDIX_B).map(
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

function lastResult(state: BlackjackState): BlackjackResult | null {
  const last = state.rounds[state.rounds.length - 1];
  return last?.data ?? null;
}

export function deriveBlackjackAnimations(
  prev: BlackjackState,
  next: BlackjackState,
  event: TableEvent,
): AnimationTrigger[] {
  const triggers: AnimationTrigger[] = [];

  if (event.type === "SERIES_STARTED") {
    triggers.push({ eventId: "shoe_start", vars: { series: event.seriesId } });
    return triggers;
  }

  if (event.type === "RESULT_UNDONE" || event.type === "RESULT_DELETED") {
    triggers.push({ eventId: "round_undone", vars: {} });
    return triggers;
  }

  if (event.type !== "RESULT_RECORDED") return triggers;

  const result = lastResult(next);
  if (!result) return triggers;

  if (result.dealer.bust) {
    triggers.push({ eventId: "dealer_bust", vars: { total: result.dealer.total ?? "" } });
  } else if (result.dealer.blackjack) {
    triggers.push({ eventId: "dealer_blackjack", vars: {} });
  } else if (result.dealer.total !== null) {
    triggers.push({ eventId: "dealer_stand", vars: { total: result.dealer.total } });
  }

  let wins = 0;
  let losses = 0;
  let activeSeats = 0;
  for (const seat of ALL_SEATS) {
    const hands = result.seats[seat];
    if (!hands?.length) continue;
    activeSeats++;
    for (const hand of hands) {
      if (hand.outcome === "blackjack") {
        triggers.push({ eventId: "player_blackjack", vars: { seat } });
      }
      if (hand.outcome === "win" || hand.outcome === "blackjack") wins++;
      if (hand.outcome === "lose" || hand.outcome === "bust" || hand.outcome === "surrender") {
        losses++;
      }
    }
  }

  if (activeSeats >= 2 && losses === activeSeats) {
    triggers.push({ eventId: "table_sweep", vars: {} });
  }
  if (activeSeats >= 2 && wins === activeSeats) {
    triggers.push({ eventId: "table_win", vars: {} });
  }

  if (next.streak && next.streak.side === "dealer" && next.streak.length >= 5) {
    triggers.push({
      eventId: "dealer_streak",
      vars: { streak: next.streak.length },
    });
  }

  return triggers;
}
