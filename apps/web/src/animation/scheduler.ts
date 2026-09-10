import type { AnimationEventDef, AnimationPreset, AnimationTrigger } from "@casino-lord/core";

export type TimelinePhase = "main" | "layered" | "followup";

export interface ScheduledSegment {
  eventId: string;
  preset: AnimationPreset;
  trigger: AnimationTrigger;
  startMs: number;
  endMs: number;
  phase: TimelinePhase;
}

export interface AnimationTimeline {
  segments: ScheduledSegment[];
  totalMs: number;
  blockBoardUpdate: boolean;
}

export interface BuildTimelineOptions {
  prefersReducedMotion: boolean;
  maxTotalMs?: number;
  phoneMode?: boolean;
  resolvePreset: (eventId: string) => AnimationPreset;
}

const REDUCED_FLASH_MAX_MS = 600;
const PHONE_MAX_MS = 1200;

const PHONE_HEAVY_STYLES = new Set([
  "dragon",
  "trail",
  "particles",
  "burst",
  "sweep",
  "shake",
  "spin",
  "chips",
]);

export function applyPhoneMainPreset(preset: AnimationPreset): AnimationPreset {
  const style =
    preset.style === "banner"
      ? "banner"
      : PHONE_HEAVY_STYLES.has(preset.style)
        ? "flash"
        : preset.style === "flash"
          ? "flash"
          : "flash";
  return {
    ...preset,
    style,
    intensity: 1,
    durationMs: Math.min(preset.durationMs, PHONE_MAX_MS),
  };
}

export function applyReducedMotion(preset: AnimationPreset): AnimationPreset {
  return {
    ...preset,
    style: "flash",
    intensity: 1,
    durationMs: Math.min(preset.durationMs, REDUCED_FLASH_MAX_MS),
  };
}

function isLayered(def: AnimationEventDef | undefined): boolean {
  return def?.layered === true;
}

function withLayeredIntensity(preset: AnimationPreset): AnimationPreset {
  return { ...preset, intensity: 1 };
}

function preparePreset(
  preset: AnimationPreset,
  opts: BuildTimelineOptions,
  layered: boolean,
): AnimationPreset {
  let next = layered ? withLayeredIntensity(preset) : preset;
  if (opts.prefersReducedMotion) next = applyReducedMotion(next);
  return next;
}

function scaleTimeline(segments: ScheduledSegment[], maxTotalMs: number): ScheduledSegment[] {
  const end = segments.reduce((max, s) => Math.max(max, s.endMs), 0);
  if (end <= maxTotalMs || end === 0) return segments;

  const scale = maxTotalMs / end;
  return segments.map((s) => ({
    ...s,
    startMs: Math.round(s.startMs * scale),
    endMs: Math.round(s.endMs * scale),
    preset: {
      ...s.preset,
      durationMs: Math.max(1, Math.round((s.endMs - s.startMs) * scale)),
    },
  }));
}

export function buildAnimationTimeline(
  triggers: AnimationTrigger[],
  eventDefs: AnimationEventDef[],
  opts: BuildTimelineOptions,
): AnimationTimeline | null {
  const defMap = new Map(eventDefs.map((d) => [d.id, d]));
  const maxTotalMs = opts.phoneMode ? PHONE_MAX_MS : (opts.maxTotalMs ?? 4000);

  const resolved = triggers
    .map((trigger) => {
      const preset = opts.resolvePreset(trigger.eventId);
      if (!preset.enabled) return null;
      const def = defMap.get(trigger.eventId);
      return {
        trigger,
        def,
        preset,
        layered: isLayered(def),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (resolved.length === 0) return null;

  const mainIndex = resolved.findIndex((item) => !item.layered);
  if (mainIndex === -1) return null;

  const mainItem = resolved[mainIndex]!;
  const mainPresetRaw = opts.phoneMode ? applyPhoneMainPreset(mainItem.preset) : mainItem.preset;
  const mainPreset = preparePreset(mainPresetRaw, opts, false);
  const segments: ScheduledSegment[] = [];

  const mainDuration = mainPreset.durationMs;
  segments.push({
    eventId: mainItem.trigger.eventId,
    preset: mainPreset,
    trigger: mainItem.trigger,
    startMs: 0,
    endMs: mainDuration,
    phase: "main",
  });

  if (opts.phoneMode) {
    const scaled = scaleTimeline(segments, maxTotalMs);
    const totalMs = scaled.reduce((max, s) => Math.max(max, s.endMs), 0);
    return {
      segments: scaled,
      totalMs,
      blockBoardUpdate: mainPreset.blockBoardUpdate,
    };
  }

  for (let i = 0; i < resolved.length; i++) {
    if (i === mainIndex || !resolved[i]!.layered) continue;
    const item = resolved[i]!;
    const preset = preparePreset(item.preset, opts, true);
    segments.push({
      eventId: item.trigger.eventId,
      preset,
      trigger: item.trigger,
      startMs: 0,
      endMs: preset.durationMs,
      phase: "layered",
    });
  }

  let cursor = mainDuration;
  for (let i = 0; i < resolved.length; i++) {
    if (i === mainIndex || resolved[i]!.layered) continue;
    const item = resolved[i]!;
    const preset = preparePreset(item.preset, opts, false);
    segments.push({
      eventId: item.trigger.eventId,
      preset,
      trigger: item.trigger,
      startMs: cursor,
      endMs: cursor + preset.durationMs,
      phase: "followup",
    });
    cursor += preset.durationMs;
  }

  const scaled = scaleTimeline(segments, maxTotalMs);
  const totalMs = scaled.reduce((max, s) => Math.max(max, s.endMs), 0);

  return {
    segments: scaled,
    totalMs,
    blockBoardUpdate: mainPreset.blockBoardUpdate,
  };
}

export function isTimelineInterrupted(current: AnimationTimeline, elapsedMs: number): boolean {
  return elapsedMs < current.totalMs;
}
