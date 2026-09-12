import "./playing-card.css";

const SUIT_GLYPH: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

function isRedSuit(suit: string | null | undefined): boolean {
  return suit === "H" || suit === "D";
}

function suitGlyph(suit: string | null | undefined): string {
  if (!suit) return "";
  return SUIT_GLYPH[suit] ?? "";
}

export function playingCardLabel(
  rank?: string,
  suit?: string | null,
  faceDown = false,
  empty = false,
): string {
  if (empty) return "Empty card";
  if (faceDown) return "Face-down card";
  if (!rank) return "Card";
  return `${rank}${suitGlyph(suit)}`;
}

export type PlayingCardSize = "sm" | "md" | "lg" | "xl";

export interface PlayingCardProps {
  rank?: string;
  suit?: string | null;
  faceDown?: boolean;
  empty?: boolean;
  size?: PlayingCardSize;
  highlight?: boolean;
  label?: string;
  class?: string;
  testId?: string;
}

function Corner({ rank, suit, color }: { rank: string; suit: string; color: string }) {
  const rankSize = rank === "10" ? 9 : 11;
  return (
    <g>
      <text
        x="9"
        y="14"
        text-anchor="middle"
        fill={color}
        font-size={rankSize}
        font-weight="700"
        font-family="Georgia, 'Times New Roman', serif"
      >
        {rank}
      </text>
      <text
        x="9"
        y="26"
        text-anchor="middle"
        fill={color}
        font-size="11"
        font-family="Georgia, 'Times New Roman', serif"
      >
        {suit}
      </text>
    </g>
  );
}

function FaceArt({ rank, suit, color }: { rank: string; suit: string; color: string }) {
  const court = rank === "J" || rank === "Q" || rank === "K";
  if (court) {
    return (
      <g>
        <rect
          x="22"
          y="34"
          width="26"
          height="32"
          rx="3"
          fill="none"
          stroke={color}
          stroke-width="1.2"
        />
        <text
          x="35"
          y="56"
          text-anchor="middle"
          fill={color}
          font-size="18"
          font-weight="700"
          font-family="Georgia, 'Times New Roman', serif"
        >
          {rank}
        </text>
        <text x="35" y="68" text-anchor="middle" fill={color} font-size="10">
          {suit}
        </text>
      </g>
    );
  }
  return (
    <text
      x="35"
      y="62"
      text-anchor="middle"
      fill={color}
      font-size={rank === "10" ? 22 : 28}
      font-family="Georgia, 'Times New Roman', serif"
    >
      {suit || rank}
    </text>
  );
}

export function PlayingCard({
  rank,
  suit = null,
  faceDown = false,
  empty = false,
  size = "md",
  highlight = false,
  label,
  class: extraClass,
  testId,
}: PlayingCardProps) {
  const aria = label ?? playingCardLabel(rank, suit, faceDown, empty);
  const classes = [
    "playing-card",
    `playing-card--${size}`,
    highlight ? "playing-card--highlight" : "",
    empty ? "playing-card--empty" : "",
    extraClass ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const color = isRedSuit(suit) ? "#c8102e" : "#161616";
  const glyph = suitGlyph(suit);
  const shownRank = rank ?? "";

  return (
    <span
      class={classes}
      role="img"
      aria-label={aria}
      {...(testId ? { "data-testid": testId } : {})}
    >
      <svg viewBox="0 0 70 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <pattern
            id="playing-card-lattice"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" fill="#1b2744" />
            <path d="M0 0 L8 8 M8 0 L0 8" stroke="#c9a227" stroke-width="0.6" opacity="0.85" />
          </pattern>
        </defs>
        {empty ? (
          <rect
            x="1.5"
            y="1.5"
            width="67"
            height="97"
            rx="6"
            fill="rgba(244,234,208,0.08)"
            stroke="rgba(245,245,240,0.45)"
            stroke-width="1.5"
            stroke-dasharray="4 3"
          />
        ) : faceDown ? (
          <>
            <rect
              x="1"
              y="1"
              width="68"
              height="98"
              rx="6"
              fill="#1b2744"
              stroke="#c9a227"
              stroke-width="2"
            />
            <rect x="6" y="6" width="58" height="88" rx="3" fill="url(#playing-card-lattice)" />
            <circle cx="35" cy="50" r="10" fill="#1b2744" stroke="#c9a227" stroke-width="1.4" />
            <text
              x="35"
              y="54"
              text-anchor="middle"
              fill="#c9a227"
              font-size="12"
              font-family="Georgia, 'Times New Roman', serif"
            >
              ♠
            </text>
          </>
        ) : (
          <>
            <rect
              x="1"
              y="1"
              width="68"
              height="98"
              rx="6"
              fill="#f4ead0"
              stroke="#1a1a1a"
              stroke-width="1.4"
            />
            <Corner rank={shownRank} suit={glyph} color={color} />
            <g transform="rotate(180 35 50)">
              <Corner rank={shownRank} suit={glyph} color={color} />
            </g>
            <FaceArt rank={shownRank} suit={glyph} color={color} />
          </>
        )}
      </svg>
    </span>
  );
}
