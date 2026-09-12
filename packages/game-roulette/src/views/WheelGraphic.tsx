import type { Pocket } from "../types.js";
import type { RouletteRules } from "../rules.js";
import { classifyPocket, wheelOrder } from "../wheel.js";
import type { SpinRecord } from "../types.js";

export interface WheelGraphicProps {
  rules: RouletteRules;
  lastSpin: SpinRecord | null;
  counts?: Record<string, number>;
  sectorHeat?: boolean;
}

function pocketKey(p: Pocket): string {
  return p === "00" ? "00" : String(p);
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function wedgePath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = polar(cx, cy, r1, a0);
  const [x1, y1] = polar(cx, cy, r1, a1);
  const [x2, y2] = polar(cx, cy, r0, a1);
  const [x3, y3] = polar(cx, cy, r0, a0);
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

const CX = 160;
const CY = 160;
const RIM = 156;
const TRACK_OUTER = 146;
const TRACK_INNER = 88;
const NUMBER_R = 136;
const BALL_R = 108;

export function WheelGraphic({ rules, lastSpin, counts, sectorHeat }: WheelGraphicProps) {
  const order = wheelOrder(rules);
  const winning = lastSpin?.pocket ?? null;
  const maxCount = sectorHeat && counts ? Math.max(1, ...Object.values(counts)) : 1;
  const slice = 360 / order.length;

  return (
    <svg
      class="wheel-graphic"
      data-testid="roulette-wheel"
      viewBox="0 0 320 320"
      role="img"
      aria-label="Roulette wheel"
    >
      <circle cx={CX} cy={CY} r={RIM} fill="#5c3a1e" stroke="#d4af37" stroke-width="5" />
      <circle cx={CX} cy={CY} r={TRACK_OUTER + 2} fill="#1a120c" />
      {order.map((pocket, index) => {
        const a0 = -90 + index * slice;
        const a1 = a0 + slice;
        const mid = a0 + slice / 2;
        const info = classifyPocket(pocket, rules);
        const isWinning = winning !== null && pocketKey(pocket) === pocketKey(winning);
        const count = counts?.[pocketKey(pocket)] ?? 0;
        const heatOpacity = sectorHeat && count > 0 ? 0.2 + (count / maxCount) * 0.55 : 0;
        const fill =
          info.color === "red" ? "#d7263d" : info.color === "green" ? "#1e8f4e" : "#111318";
        const [nx, ny] = polar(CX, CY, NUMBER_R, mid);
        const [bx, by] = polar(CX, CY, BALL_R, mid);

        return (
          <g key={pocketKey(pocket)} data-pocket={pocketKey(pocket)}>
            <path
              d={wedgePath(CX, CY, TRACK_INNER, TRACK_OUTER, a0, a1)}
              class={`wheel-graphic__pocket wheel-graphic__pocket--${info.color}${isWinning ? " wheel-graphic__pocket--winning" : ""}`}
              fill={fill}
              stroke={isWinning ? "#d4af37" : "#2a2118"}
              stroke-width={isWinning ? 2 : 0.6}
            />
            {heatOpacity > 0 && (
              <path
                d={wedgePath(CX, CY, TRACK_INNER, TRACK_OUTER, a0, a1)}
                fill="#d4af37"
                opacity={heatOpacity}
              />
            )}
            <text
              x={nx}
              y={ny + 3.2}
              text-anchor="middle"
              fill="#f5f5f5"
              font-size={order.length > 37 ? 7.5 : 8.5}
              font-weight="700"
            >
              {pocketKey(pocket)}
            </text>
            {isWinning && (
              <circle
                cx={bx}
                cy={by}
                r="5.2"
                fill="#f8fafc"
                stroke="#94a3b8"
                stroke-width="1.2"
                data-testid="wheel-ball"
              />
            )}
          </g>
        );
      })}
      {order.map((_, index) => {
        const a = -90 + index * slice;
        const [x0, y0] = polar(CX, CY, TRACK_INNER, a);
        const [x1, y1] = polar(CX, CY, TRACK_OUTER, a);
        return (
          <line
            key={`fret-${index}`}
            x1={x0}
            y1={y0}
            x2={x1}
            y2={y1}
            stroke="#c0c7d1"
            stroke-width="0.7"
            opacity="0.55"
          />
        );
      })}
      <circle
        cx={CX}
        cy={CY}
        r={TRACK_INNER - 2}
        fill="#2a2118"
        stroke="#d4af37"
        stroke-width="2"
      />
      <circle cx={CX} cy={CY} r="28" fill="#8a6a2f" stroke="#d4af37" stroke-width="2" />
      <circle cx={CX} cy={CY} r="12" fill="#d4af37" />
      <polygon points="160,6 151,26 169,26" fill="#d4af37" />
    </svg>
  );
}
