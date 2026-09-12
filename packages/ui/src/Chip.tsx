import "./chip.css";

export interface ChipPalette {
  fill: string;
  ink: string;
  edge: string;
}

const DENOM_ORDER = [1000, 500, 100, 25, 5] as const;

export function chipColor(denom: number): ChipPalette {
  if (denom >= 1000) return { fill: "#c9a227", ink: "#1a1204", edge: "#f4e4a4" };
  if (denom >= 500) return { fill: "#6d28d9", ink: "#f8f5ff", edge: "#ddd6fe" };
  if (denom >= 100) return { fill: "#171717", ink: "#f5f5f5", edge: "#e5e5e5" };
  if (denom >= 25) return { fill: "#15803d", ink: "#f4fff6", edge: "#bbf7d0" };
  return { fill: "#dc2626", ink: "#fff7f7", edge: "#fecaca" };
}

export interface ChipSplit {
  denoms: number[];
  overflow: number;
}

export function splitChipAmount(amount: number, maxVisible = 6): ChipSplit {
  let remain = Math.max(0, Math.floor(amount));
  const denoms: number[] = [];
  for (const d of DENOM_ORDER) {
    while (remain >= d) {
      denoms.push(d);
      remain -= d;
    }
  }
  if (remain > 0) denoms.push(5);
  if (denoms.length <= maxVisible) return { denoms, overflow: 0 };
  return { denoms: denoms.slice(0, maxVisible), overflow: denoms.length - maxVisible };
}

export type ChipSize = "xs" | "sm" | "md" | "lg";

export interface ChipProps {
  denom: number;
  size?: ChipSize;
  playerColor?: string;
  label?: string;
  class?: string;
  testId?: string;
}

const SPOT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function Chip({
  denom,
  size = "md",
  playerColor,
  label,
  class: extraClass,
  testId,
}: ChipProps) {
  const palette = chipColor(denom);
  const rim = playerColor ?? palette.edge;
  const aria = label ?? `${denom} chip`;
  const classes = ["chip", `chip--${size}`, extraClass ?? ""].filter(Boolean).join(" ");

  return (
    <span
      class={classes}
      role="img"
      aria-label={aria}
      {...(testId ? { "data-testid": testId } : {})}
    >
      <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="20" cy="20" r="18.5" fill={palette.fill} stroke={rim} stroke-width="2.2" />
        <circle
          cx="20"
          cy="20"
          r="12.5"
          fill="none"
          stroke={palette.edge}
          stroke-width="1.4"
          opacity="0.9"
        />
        {SPOT_ANGLES.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x = 20 + Math.cos(rad) * 16.1;
          const y = 20 + Math.sin(rad) * 16.1;
          return <circle key={deg} cx={x} cy={y} r="1.35" fill={palette.edge} />;
        })}
        <text
          x="20"
          y="23.5"
          text-anchor="middle"
          fill={palette.ink}
          font-size={denom >= 1000 ? 8 : 9}
          font-weight="700"
          font-family="system-ui, sans-serif"
        >
          {denom}
        </text>
      </svg>
    </span>
  );
}

export interface ChipStackProps {
  amount: number;
  size?: ChipSize;
  playerColor?: string;
  showAmount?: boolean;
  class?: string;
  testId?: string;
}

export function ChipStack({
  amount,
  size = "sm",
  playerColor,
  showAmount = false,
  class: extraClass,
  testId,
}: ChipStackProps) {
  const { denoms, overflow } = splitChipAmount(amount);
  if (amount <= 0) return null;
  const classes = ["chip-stack", extraClass ?? ""].filter(Boolean).join(" ");

  return (
    <span class={classes} {...(testId ? { "data-testid": testId } : {})}>
      {denoms.map((denom, i) => (
        <span class="chip-stack__item" key={`${denom}-${i}`}>
          <Chip denom={denom} size={size} {...(playerColor ? { playerColor } : {})} />
        </span>
      ))}
      {overflow > 0 && <span class="chip-stack__overflow">+{overflow}</span>}
      {showAmount && <span class="chip-stack__amount">{amount}</span>}
    </span>
  );
}
