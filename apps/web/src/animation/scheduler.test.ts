import type { AnimationEventDef, AnimationPreset, AnimationTrigger } from "@casino-lord/core";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { describe, expect, it } from "vitest";

const baccaratAnimationEvents = baccaratModule.animationEvents;
import {
  applyPhoneMainPreset,
  applyReducedMotion,
  buildAnimationTimeline,
  isTimelineInterrupted,
} from "./scheduler.js";

const APPENDIX_C: Record<string, AnimationPreset> = Object.fromEntries(
  baccaratAnimationEvents.map((def) => [def.id, def.defaultPreset]),
);

function resolve(eventId: string): AnimationPreset {
  return (
    APPENDIX_C[eventId] ?? {
      enabled: false,
      style: "none",
      durationMs: 0,
      intensity: 1,
      sound: null,
      soundVolume: 0,
      blockBoardUpdate: false,
    }
  );
}

describe("buildAnimationTimeline", () => {
  it("schedules main first with layered concurrent at intensity 1", () => {
    const triggers: AnimationTrigger[] = [
      { eventId: "player_win", vars: { total: 7 } },
      { eventId: "player_pair", vars: {} },
      { eventId: "natural", vars: { total: 7 } },
    ];

    const timeline = buildAnimationTimeline(triggers, baccaratAnimationEvents, {
      prefersReducedMotion: false,
      resolvePreset: resolve,
    });

    expect(timeline).not.toBeNull();
    const main = timeline!.segments.find((s) => s.phase === "main");
    const layered = timeline!.segments.filter((s) => s.phase === "layered");
    expect(main?.eventId).toBe("player_win");
    expect(main?.startMs).toBe(0);
    expect(layered).toHaveLength(2);
    for (const seg of layered) {
      expect(seg.startMs).toBe(0);
      expect(seg.preset.intensity).toBe(1);
    }
  });

  it("chains non-layered follow-ups after main", () => {
    const triggers: AnimationTrigger[] = [
      { eventId: "banker_win", vars: { total: 8 } },
      { eventId: "dragon", vars: { outcome: "BANKER", streak: 7 }, path: [{ x: 0, y: 0 }] },
    ];

    const timeline = buildAnimationTimeline(triggers, baccaratAnimationEvents, {
      prefersReducedMotion: false,
      resolvePreset: resolve,
    });

    const main = timeline!.segments.find((s) => s.phase === "main");
    const followup = timeline!.segments.find((s) => s.phase === "followup");
    expect(followup?.eventId).toBe("dragon");
    expect(followup!.startMs).toBe(main!.endMs);
  });

  it("caps total duration at 4 seconds", () => {
    const longDefs: AnimationEventDef[] = [
      {
        id: "long_main",
        label: "long",
        defaultPreset: {
          enabled: true,
          style: "sweep",
          durationMs: 3000,
          intensity: 2,
          sound: null,
          soundVolume: 0.5,
          blockBoardUpdate: false,
        },
      },
      {
        id: "long_follow",
        label: "follow",
        defaultPreset: {
          enabled: true,
          style: "dragon",
          durationMs: 3000,
          intensity: 3,
          sound: null,
          soundVolume: 0.8,
          blockBoardUpdate: true,
        },
      },
    ];

    const timeline = buildAnimationTimeline(
      [
        { eventId: "long_main", vars: {} },
        { eventId: "long_follow", vars: {} },
      ],
      longDefs,
      {
        prefersReducedMotion: false,
        maxTotalMs: 4000,
        resolvePreset: (id) => longDefs.find((d) => d.id === id)!.defaultPreset,
      },
    );

    expect(timeline!.totalMs).toBeLessThanOrEqual(4000);
  });

  it("collapses to flash intensity 1 under reduced motion", () => {
    const timeline = buildAnimationTimeline(
      [{ eventId: "player_win", vars: { total: 7 } }],
      baccaratAnimationEvents,
      {
        prefersReducedMotion: true,
        resolvePreset: resolve,
      },
    );

    expect(timeline!.segments[0]!.preset.style).toBe("flash");
    expect(timeline!.segments[0]!.preset.intensity).toBe(1);
  });

  it("applyReducedMotion forces flash", () => {
    const reduced = applyReducedMotion({
      enabled: true,
      style: "particles",
      durationMs: 2000,
      intensity: 3,
      sound: null,
      soundVolume: 0.5,
      blockBoardUpdate: false,
    });
    expect(reduced.style).toBe("flash");
    expect(reduced.intensity).toBe(1);
  });

  it("reports interruption while timeline still running", () => {
    const timeline = buildAnimationTimeline(
      [{ eventId: "player_win", vars: { total: 7 } }],
      baccaratAnimationEvents,
      { prefersReducedMotion: false, resolvePreset: resolve },
    )!;
    expect(isTimelineInterrupted(timeline, 100)).toBe(true);
    expect(isTimelineInterrupted(timeline, timeline.totalMs + 1)).toBe(false);
  });

  it("phoneMode caps main to flash/banner at intensity 1 within 1.2s", () => {
    const timeline = buildAnimationTimeline(
      [
        { eventId: "banker_win", vars: { total: 8 } },
        { eventId: "dragon", vars: { outcome: "BANKER", streak: 7 }, path: [{ x: 0, y: 0 }] },
      ],
      baccaratAnimationEvents,
      {
        prefersReducedMotion: false,
        phoneMode: true,
        resolvePreset: resolve,
      },
    );

    expect(timeline).not.toBeNull();
    expect(timeline!.totalMs).toBeLessThanOrEqual(1200);
    expect(timeline!.segments).toHaveLength(1);
    const main = timeline!.segments[0]!;
    expect(main.phase).toBe("main");
    expect(main.preset.intensity).toBe(1);
    expect(["flash", "banner"]).toContain(main.preset.style);
  });

  it("applyPhoneMainPreset converts dragon to flash", () => {
    const phone = applyPhoneMainPreset({
      enabled: true,
      style: "dragon",
      durationMs: 3000,
      intensity: 3,
      sound: null,
      soundVolume: 0.5,
      blockBoardUpdate: false,
    });
    expect(phone.style).toBe("flash");
    expect(phone.intensity).toBe(1);
    expect(phone.durationMs).toBeLessThanOrEqual(1200);
  });

  it("returns null when all triggers disabled", () => {
    const timeline = buildAnimationTimeline(
      [{ eventId: "dragon_broken", vars: {} }],
      baccaratAnimationEvents,
      { prefersReducedMotion: false, resolvePreset: resolve },
    );
    expect(timeline).toBeNull();
  });
});
