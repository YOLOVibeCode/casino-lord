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

export function WheelGraphic({ rules, lastSpin, counts, sectorHeat }: WheelGraphicProps) {
  const order = wheelOrder(rules);
  const winning = lastSpin?.pocket ?? null;
  const maxCount = sectorHeat && counts ? Math.max(1, ...Object.values(counts)) : 1;

  return (
    <svg
      class="wheel-graphic"
      data-testid="roulette-wheel"
      viewBox="0 0 320 320"
      role="img"
      aria-label="Roulette wheel"
    >
      <circle cx="160" cy="160" r="150" fill="#1a1d22" stroke="#d4af37" stroke-width="4" />
      <circle cx="160" cy="160" r="20" fill="#d4af37" />
      {order.map((pocket, index) => {
        const angle = (index / order.length) * Math.PI * 2 - Math.PI / 2;
        const radius = 115;
        const x = 160 + Math.cos(angle) * radius;
        const y = 160 + Math.sin(angle) * radius;
        const info = classifyPocket(pocket, rules);
        const isWinning = winning !== null && pocketKey(pocket) === pocketKey(winning);
        const count = counts?.[pocketKey(pocket)] ?? 0;
        const heatOpacity = sectorHeat && count > 0 ? 0.25 + (count / maxCount) * 0.55 : 0;

        return (
          <g key={pocketKey(pocket)} data-pocket={pocketKey(pocket)}>
            <circle
              cx={x}
              cy={y}
              r={isWinning ? 16 : 13}
              class={`wheel-graphic__pocket wheel-graphic__pocket--${info.color}${isWinning ? " wheel-graphic__pocket--winning" : ""}`}
              fill={
                info.color === "red" ? "#d7263d" : info.color === "green" ? "#1e8f4e" : "#111318"
              }
              stroke={isWinning ? "#d4af37" : "#2a2d34"}
              stroke-width={isWinning ? 3 : 1}
              opacity={heatOpacity > 0 ? heatOpacity : 1}
            />
            <text
              x={x}
              y={y + 4}
              text-anchor="middle"
              fill="#f5f5f5"
              font-size="10"
              font-weight="700"
            >
              {pocketKey(pocket)}
            </text>
          </g>
        );
      })}
      <polygon points="160,8 150,28 170,28" fill="#d4af37" />
    </svg>
  );
}
