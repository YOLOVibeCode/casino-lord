import "./die.css";

export type DieFace = 1 | 2 | 3 | 4 | 5 | 6;

const PIP_LAYOUT: Record<DieFace, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const PIP_XY: [number, number][] = [
  [11, 11],
  [20, 11],
  [29, 11],
  [11, 20],
  [20, 20],
  [29, 20],
  [11, 29],
  [20, 29],
  [29, 29],
];

export type DieSize = "sm" | "md" | "lg";

export interface DieProps {
  face: DieFace;
  size?: DieSize;
  class?: string;
  testId?: string;
}

export function Die({ face, size = "md", class: extraClass, testId }: DieProps) {
  const classes = ["die", `die--${size}`, extraClass ?? ""].filter(Boolean).join(" ");
  const pips = PIP_LAYOUT[face];

  return (
    <span
      class={classes}
      role="img"
      aria-label={`Die showing ${face}`}
      {...(testId ? { "data-testid": testId } : {})}
    >
      <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="die-bevel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f87171" />
            <stop offset="45%" stop-color="#dc2626" />
            <stop offset="100%" stop-color="#7f1d1d" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="6" fill="url(#die-bevel)" />
        <rect
          x="4.5"
          y="4.5"
          width="31"
          height="31"
          rx="4.5"
          fill="#e11d48"
          stroke="rgba(255,255,255,0.22)"
          stroke-width="1"
        />
        {PIP_XY.map(([x, y], i) =>
          pips.includes(i) ? <circle key={i} cx={x} cy={y} r="2.6" fill="#f8fafc" /> : null,
        )}
      </svg>
    </span>
  );
}
