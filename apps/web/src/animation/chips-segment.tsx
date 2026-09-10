import type { Point } from "./measure-path.js";
import type { TimelinePhase } from "./scheduler.js";

const CHIP_CAP = 60;

function chipCount(intensity: 1 | 2 | 3): number {
  return Math.min(CHIP_CAP, 6 + intensity * 6);
}

export interface ChipsSegmentProps {
  color: string;
  intensity: 1 | 2 | 3;
  durationMs: number;
  anchor: Point;
  phase: TimelinePhase;
}

export function ChipsSegment({ color, intensity, durationMs, anchor, phase }: ChipsSegmentProps) {
  const count = chipCount(intensity);
  const chips = Array.from({ length: count }, (_, i) => i);

  return (
    <div
      class="animation-layer__chips"
      data-style="chips"
      data-phase={phase}
      aria-hidden="true"
      style={{
        "--anim-color": color,
        "--anim-duration": `${durationMs}ms`,
        "--chip-origin-x": `${anchor.x}px`,
        "--chip-origin-y": `${anchor.y}px`,
      }}
    >
      {chips.map((i) => (
        <span
          key={i}
          class="animation-layer__chip"
          style={{ animationDelay: `${(i / count) * durationMs * 0.35}ms` }}
        />
      ))}
    </div>
  );
}
