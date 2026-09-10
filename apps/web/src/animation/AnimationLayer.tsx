import type { AnimationStyle } from "@casino-lord/core";
import { createElement } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { ChipsSegment } from "./chips-segment.js";
import type { Point } from "./measure-path.js";
import { SpinSegment } from "./spin-segment.js";
import type { TimelinePhase } from "./scheduler.js";
import "./animation-layer.css";

export interface ActiveSegment {
  id: string;
  style: AnimationStyle;
  color: string;
  intensity: 1 | 2 | 3;
  durationMs: number;
  text?: string;
  anchor?: Point;
  path?: Point[];
  vars?: Record<string, string | number>;
  phase: TimelinePhase;
}

export interface AnimationLayerProps {
  segments: ActiveSegment[];
  onShakeChange?: (active: boolean, durationMs: number) => void;
}

const PARTICLE_CAP = 60;

function particleCount(intensity: 1 | 2 | 3): number {
  return Math.min(PARTICLE_CAP, 20 * intensity);
}

function BurstCanvas({
  color,
  intensity,
  durationMs,
  anchor,
}: {
  color: string;
  intensity: 1 | 2 | 3;
  durationMs: number;
  anchor?: Point;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const cx = anchor?.x ?? rect.width / 2;
    const cy = anchor?.y ?? rect.height / 2;
    const count = particleCount(intensity);
    const particles = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const speed = 80 + intensity * 40;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      };
    });

    const start = performance.now();
    let frame = 0;

    const tick = (now: number): void => {
      const elapsed = now - start;
      if (elapsed >= durationMs) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const alpha = 1 - elapsed / durationMs;
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;

      for (const p of particles) {
        p.x += (p.vx * 16) / 1000;
        p.y += (p.vy * 16) / 1000;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + intensity, 0, Math.PI * 2);
        ctx.fill();
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [anchor?.x, anchor?.y, color, durationMs, intensity]);

  return <canvas class="animation-layer__canvas" data-style="burst" ref={ref} aria-hidden="true" />;
}

function ParticlesCanvas({
  color,
  intensity,
  durationMs,
  anchor,
}: {
  color: string;
  intensity: 1 | 2 | 3;
  durationMs: number;
  anchor?: Point;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const originX = anchor?.x ?? rect.width / 2;
    const originY = anchor?.y ?? rect.height * 0.2;
    const count = particleCount(intensity);
    const particles = Array.from({ length: count }, () => ({
      x: originX + (Math.random() - 0.5) * 40,
      y: originY,
      vx: (Math.random() - 0.5) * 120,
      vy: 60 + Math.random() * 160,
      spin: Math.random() * Math.PI,
    }));

    const start = performance.now();
    let frame = 0;

    const tick = (now: number): void => {
      const elapsed = now - start;
      if (elapsed >= durationMs) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;
      ctx.globalAlpha = 1 - elapsed / durationMs;

      for (const p of particles) {
        p.x += (p.vx * 16) / 1000;
        p.y += (p.vy * 16) / 1000;
        p.spin += 0.05;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillRect(-3, -1, 6, 2);
        ctx.restore();
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [anchor?.x, anchor?.y, color, durationMs, intensity]);

  return (
    <canvas class="animation-layer__canvas" data-style="particles" ref={ref} aria-hidden="true" />
  );
}

function pathD(path: Point[]): string {
  if (path.length === 0) return "";
  const [first, ...rest] = path;
  return `M ${first!.x} ${first!.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")}`;
}

function PathSvg({
  style,
  color,
  intensity,
  durationMs,
  path,
}: {
  style: "trail" | "dragon";
  color: string;
  intensity: 1 | 2 | 3;
  durationMs: number;
  path: Point[];
}) {
  const stroke = 4 + intensity * 2;
  const d = pathD(path);
  const head = path[path.length - 1];

  return (
    <svg class="animation-layer__svg" data-style={style} aria-hidden="true">
      <path
        class="animation-layer__path-glow"
        d={d}
        stroke-width={stroke}
        pathLength={100}
        stroke-dasharray="100"
        stroke-dashoffset="100"
        style={{
          animation: `animation-path-draw ${durationMs}ms ease-out forwards`,
          "--anim-color": color,
        }}
      />
      {style === "dragon" && head && (
        <ellipse
          class="animation-layer__dragon-head"
          cx={head.x}
          cy={head.y}
          rx={8 + intensity * 2}
          ry={5 + intensity}
          style={{ "--anim-color": color }}
        />
      )}
    </svg>
  );
}

function StyleSegment({ segment }: { segment: ActiveSegment }) {
  const styleProps = {
    "data-style": segment.style,
    "data-phase": segment.phase,
    style: {
      "--anim-color": segment.color,
      "--anim-duration": `${segment.durationMs}ms`,
    } as Record<string, string>,
  };

  switch (segment.style) {
    case "none":
      return null;
    case "flash":
      return (
        <div
          class={`animation-layer__flash animation-layer__flash--${segment.intensity}`}
          {...styleProps}
        />
      );
    case "burst":
      return (
        <BurstCanvas
          color={segment.color}
          intensity={segment.intensity}
          durationMs={segment.durationMs}
          {...(segment.anchor ? { anchor: segment.anchor } : {})}
        />
      );
    case "sweep":
      return <div class="animation-layer__sweep" {...styleProps} />;
    case "banner":
      return (
        <div class="animation-layer__banner" {...styleProps}>
          {segment.text ?? ""}
        </div>
      );
    case "particles":
      return (
        <ParticlesCanvas
          color={segment.color}
          intensity={segment.intensity}
          durationMs={segment.durationMs}
          {...(segment.anchor ? { anchor: segment.anchor } : {})}
        />
      );
    case "trail":
      return (
        <PathSvg
          style="trail"
          color={segment.color}
          intensity={segment.intensity}
          durationMs={segment.durationMs}
          path={segment.path ?? []}
        />
      );
    case "dragon":
      return (
        <PathSvg
          style="dragon"
          color={segment.color}
          intensity={segment.intensity}
          durationMs={segment.durationMs}
          path={segment.path ?? []}
        />
      );
    case "shake":
      return <div data-style="shake" data-phase={segment.phase} aria-hidden="true" />;
    case "spin":
      return <SpinSegment segment={segment} />;
    case "chips":
      return (
        <ChipsSegment
          color={segment.color}
          intensity={segment.intensity}
          durationMs={segment.durationMs}
          anchor={segment.anchor ?? { x: 0, y: 0 }}
          phase={segment.phase}
        />
      );
    default: {
      const _exhaustive: never = segment.style;
      return _exhaustive;
    }
  }
}

export function AnimationLayer({ segments, onShakeChange }: AnimationLayerProps) {
  useEffect(() => {
    const shake = segments.find((s) => s.style === "shake");
    onShakeChange?.(Boolean(shake), shake?.durationMs ?? 0);
  }, [segments, onShakeChange]);

  if (segments.length === 0) return null;

  return (
    <div class="animation-layer" data-testid="animation-layer">
      {segments.map((segment) => (
        <StyleSegment key={segment.id} segment={segment} />
      ))}
    </div>
  );
}
