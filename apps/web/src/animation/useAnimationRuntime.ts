import {
  replay,
  type AnimationTrigger,
  type ComposedState,
  type TableEvent,
} from "@casino-lord/core";
import { derivePlatformAnimations } from "./platform-triggers.js";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { DeviceSettings } from "../settings/device-settings.js";
import type { UntypedGameModule } from "../table/module-types.js";
import type { TableStore } from "../table/store.js";
import type { ActiveSegment } from "./AnimationLayer.js";
import { defaultAnchor, measureRoadPath } from "./measure-path.js";
import { PLATFORM_ANIMATION_EVENTS } from "./platform-events.js";
import {
  effectiveColor,
  enrichAnimationVars,
  resolvePreset,
  substituteBannerText,
} from "./presets.js";
import { animationSound, type AnimationTone } from "./sound.js";
import { buildAnimationTimeline, type AnimationTimeline } from "./scheduler.js";

const PREVIEW_VARS: Record<string, string | number> = {
  outcome: "PLAYER",
  streak: 7,
  total: 9,
  series: 1,
};

const ANIMATION_EVENT_TYPES = new Set([
  "RESULT_RECORDED",
  "SERIES_STARTED",
  "SERIES_ENDED",
  "RESULT_UNDONE",
  "BETS_OPENED",
  "BETS_CLOSED",
  "SESSION_ENDED",
  "ANIMATION_PREVIEW",
]);

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const ANIMATION_TONES = new Set<AnimationTone>(["flash", "burst", "sweep", "dragon"]);

function toneForStyle(style: ActiveSegment["style"]): AnimationTone | null {
  switch (style) {
    case "flash":
      return "flash";
    case "burst":
    case "particles":
      return "burst";
    case "sweep":
    case "banner":
      return "sweep";
    case "dragon":
    case "trail":
      return "dragon";
    default:
      return null;
  }
}

function resolveTone(preset: {
  style: ActiveSegment["style"];
  sound?: string | null;
}): AnimationTone | null {
  if (preset.sound && ANIMATION_TONES.has(preset.sound as AnimationTone)) {
    return preset.sound as AnimationTone;
  }
  return toneForStyle(preset.style);
}

function toActiveSegment(
  segment: AnimationTimeline["segments"][number],
  overlayRoot: HTMLElement,
  index: number,
): ActiveSegment {
  const { preset, trigger, eventId } = segment;
  const vars = enrichAnimationVars(eventId, trigger.vars);
  const color = effectiveColor(preset, eventId, vars);
  const anchor = trigger.anchor
    ? {
        x: trigger.anchor.x * overlayRoot.clientWidth,
        y: trigger.anchor.y * overlayRoot.clientHeight,
      }
    : defaultAnchor(overlayRoot);
  const path = trigger.path ? measureRoadPath(overlayRoot, trigger.path) : undefined;

  return {
    id: `${eventId}-${segment.phase}-${index}`,
    style: preset.style,
    color,
    intensity: preset.intensity,
    durationMs: segment.endMs - segment.startMs,
    ...(preset.text !== undefined ? { text: substituteBannerText(preset.text, vars) } : {}),
    ...(preset.style === "burst" || preset.style === "particles" || preset.style === "chips"
      ? { anchor }
      : {}),
    ...(preset.style === "trail" || preset.style === "dragon" ? { path: path ?? [] } : {}),
    ...(preset.style === "spin" ? { vars } : {}),
    phase: segment.phase,
  };
}

export interface UseAnimationRuntimeOptions {
  store: TableStore;
  module: UntypedGameModule | undefined;
  rules: unknown;
  deviceSettings: DeviceSettings;
  overlayRef: { current: HTMLElement | null };
  enabled: boolean;
  phoneMode?: boolean;
}

export interface AnimationRuntimeState {
  activeSegments: ActiveSegment[];
  heldModuleState: unknown | null;
  boardShaking: boolean;
  shakeDurationMs: number;
  unlockSound: () => void;
}

export function useAnimationRuntime({
  store,
  module,
  rules,
  deviceSettings,
  overlayRef,
  enabled,
  phoneMode = false,
}: UseAnimationRuntimeOptions): AnimationRuntimeState {
  const lastSeenSeq = useRef(0);
  const seeded = useRef(false);
  const timers = useRef<number[]>([]);
  const timelineRef = useRef<AnimationTimeline | null>(null);

  const [activeSegments, setActiveSegments] = useState<ActiveSegment[]>([]);
  const [heldModuleState, setHeldModuleState] = useState<unknown | null>(null);
  const [boardShaking, setBoardShaking] = useState(false);
  const [shakeDurationMs, setShakeDurationMs] = useState(0);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const finishTimeline = useCallback(() => {
    clearTimers();
    timelineRef.current = null;
    setActiveSegments([]);
    setHeldModuleState(null);
    setBoardShaking(false);
    setShakeDurationMs(0);
  }, [clearTimers]);

  const playTimeline = useCallback(
    (timeline: AnimationTimeline, prevModuleState: unknown | null) => {
      clearTimers();
      timelineRef.current = timeline;

      if (timeline.blockBoardUpdate && prevModuleState !== null) {
        setHeldModuleState(prevModuleState);
      } else {
        setHeldModuleState(null);
      }

      const overlay = overlayRef.current;
      if (!overlay || !enabled) {
        finishTimeline();
        return;
      }

      const segmentsAtZero = timeline.segments.filter((s) => s.startMs === 0);
      setActiveSegments(segmentsAtZero.map((s, i) => toActiveSegment(s, overlay, i)));

      for (const segment of timeline.segments) {
        if (segment.startMs === 0) {
          if (segment.preset.style === "shake") {
            setBoardShaking(true);
            setShakeDurationMs(segment.endMs - segment.startMs);
          }
          if (deviceSettings.soundEnabled && segment.preset.sound !== null) {
            const tone = resolveTone(segment.preset);
            if (tone) animationSound.play(tone, segment.preset.soundVolume);
          }
          continue;
        }

        const startId = window.setTimeout(() => {
          const overlayEl = overlayRef.current;
          if (!overlayEl) return;
          const active = timeline.segments
            .filter((s) => s.startMs <= segment.startMs && s.endMs > segment.startMs)
            .map((s, i) => toActiveSegment(s, overlayEl, i));
          setActiveSegments(active);
          if (segment.preset.style === "shake") {
            setBoardShaking(true);
            setShakeDurationMs(segment.endMs - segment.startMs);
          }
          if (deviceSettings.soundEnabled && segment.preset.sound !== null) {
            const tone = resolveTone(segment.preset);
            if (tone) animationSound.play(tone, segment.preset.soundVolume);
          }
        }, segment.startMs);
        timers.current.push(startId);
      }

      const endId = window.setTimeout(() => finishTimeline(), timeline.totalMs);
      timers.current.push(endId);
    },
    [clearTimers, deviceSettings.soundEnabled, enabled, finishTimeline, overlayRef],
  );

  const scheduleForEvent = useCallback(
    (
      event: TableEvent,
      events: readonly TableEvent[],
      prevComposedHint?: ComposedState<unknown>,
    ) => {
      if (!enabled || !module) return;

      const tableSettings = store.getComposed().platform.settings;

      const allEventDefs = [...module.animationEvents, ...PLATFORM_ANIMATION_EVENTS];

      if (event.type === "ANIMATION_PREVIEW") {
        const trigger: AnimationTrigger = { eventId: event.eventId, vars: PREVIEW_VARS };
        const timeline = buildAnimationTimeline([trigger], allEventDefs, {
          prefersReducedMotion: prefersReducedMotion(),
          phoneMode,
          resolvePreset: (eventId) => resolvePreset(eventId, module, tableSettings),
        });
        if (timeline) playTimeline(timeline, null);
        return;
      }

      const index = events.findIndex((e) => e.seq === event.seq);
      if (index < 0) return;

      const prevComposed: ComposedState<unknown> =
        prevComposedHint ??
        (index === 0
          ? {
              module: module.initialState(rules),
              platform: replay([], module, rules, { code: store.code }).platform,
            }
          : replay(events.slice(0, index), module, rules, {
              code: store.code,
              includeEphemeral: true,
            }));

      const nextComposed: ComposedState<unknown> =
        index === events.length - 1
          ? store.getComposed()
          : replay(events.slice(0, index + 1), module, rules, {
              code: store.code,
              includeEphemeral: true,
            });

      const gameTriggers = module.deriveAnimations(prevComposed.module, nextComposed.module, event);
      const platformTriggers = derivePlatformAnimations(prevComposed, nextComposed, event);
      const triggers = [...gameTriggers, ...platformTriggers];
      if (triggers.length === 0) return;

      const timeline = buildAnimationTimeline(triggers, allEventDefs, {
        prefersReducedMotion: prefersReducedMotion(),
        phoneMode,
        resolvePreset: (eventId) => resolvePreset(eventId, module, tableSettings),
      });
      if (!timeline) return;

      playTimeline(timeline, prevComposed.module);
    },
    [enabled, module, phoneMode, playTimeline, rules, store],
  );

  useEffect(() => {
    animationSound.setEnabled(deviceSettings.soundEnabled);
  }, [deviceSettings.soundEnabled]);

  useEffect(() => {
    if (!module) return;

    lastSeenSeq.current = store.events.reduce((max, e) => Math.max(max, e.seq), 0);
    seeded.current = true;

    const processEvents = (): void => {
      const events = store.events;
      const fresh = events.filter(
        (e) => e.seq > lastSeenSeq.current && ANIMATION_EVENT_TYPES.has(e.type),
      );
      if (fresh.length === 0) return;

      let prevComposed: ComposedState<unknown> | undefined;
      for (const event of fresh) {
        if (timelineRef.current) finishTimeline();
        scheduleForEvent(event, events, prevComposed);
        lastSeenSeq.current = Math.max(lastSeenSeq.current, event.seq);

        const index = events.findIndex((e) => e.seq === event.seq);
        if (index < 0) continue;
        prevComposed =
          index === events.length - 1
            ? store.getComposed()
            : replay(events.slice(0, index + 1), module, rules, {
                code: store.code,
                includeEphemeral: true,
              });
      }
    };

    return store.subscribe(processEvents);
  }, [store, module, scheduleForEvent, finishTimeline]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const unlockSound = useCallback(() => {
    animationSound.unlock();
  }, []);

  return {
    activeSegments,
    heldModuleState,
    boardShaking,
    shakeDurationMs,
    unlockSound,
  };
}
