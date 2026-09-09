import { computeDealerFromCards } from "./engine.js";
import type { BlackjackRules } from "./rules.js";
import type { BlackjackResult, EntryDepth } from "./types.js";

const QUICK_DEALER = /^(BUST|BJ|(\d{2}))$/i;

export function parseQuickDealerToken(token: string): BlackjackResult | null {
  const upper = token.toUpperCase();
  if (upper === "BUST") {
    return {
      dealer: { cards: [], total: 22, bust: true, blackjack: false },
      seats: {},
      depth: "quick",
      dealerError: false,
    };
  }
  if (upper === "BJ") {
    return {
      dealer: { cards: [], total: 21, bust: false, blackjack: true },
      seats: {},
      depth: "quick",
      dealerError: false,
    };
  }
  const num = Number(upper);
  if (num >= 17 && num <= 21) {
    return {
      dealer: { cards: [], total: num, bust: false, blackjack: false },
      seats: {},
      depth: "quick",
      dealerError: false,
    };
  }
  return null;
}

export function isQuickDealerToken(part: string): boolean {
  const d = part.startsWith("D:") ? part.slice(2) : part;
  return QUICK_DEALER.test(d.trim());
}

export function formatQuickDealer(result: BlackjackResult): string {
  if (result.dealer.bust) return "D:BUST";
  if (result.dealer.blackjack) return "D:BJ";
  if (result.dealer.total !== null) return `D:${result.dealer.total}`;
  return "D:?";
}

export const OUTCOME_LETTERS: Record<string, import("./types.js").SeatOutcome> = {
  W: "win",
  L: "lose",
  P: "push",
  BJ: "blackjack",
  B: "bust",
  R: "surrender",
  S: "surrender",
};

export function parseOutcomeLetter(letter: string): import("./types.js").SeatOutcome | null {
  const upper = letter.toUpperCase();
  if (upper === "BJ") return "blackjack";
  return OUTCOME_LETTERS[upper] ?? null;
}

export function formatOutcomeLetter(outcome: import("./types.js").SeatOutcome): string {
  switch (outcome) {
    case "win":
      return "W";
    case "lose":
      return "L";
    case "push":
      return "P";
    case "blackjack":
      return "BJ";
    case "bust":
      return "B";
    case "surrender":
      return "R";
  }
}

export function buildQuickResult(
  dealerPart: string,
  _rules: BlackjackRules,
): BlackjackResult | null {
  const token = dealerPart.startsWith("D:") ? dealerPart.slice(2) : dealerPart;
  return parseQuickDealerToken(token);
}

export function inferDepthFromLine(parts: string[]): EntryDepth {
  const dealerPart = parts[0] ?? "";
  if (isQuickDealerToken(dealerPart)) return "quick";
  for (const part of parts.slice(1)) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const body = part.slice(colon + 1).trim();
    if (/^[WLPBJBR]$/i.test(body) || body.includes("×")) return "outcomes";
    if (body.includes(",") || body.includes(";")) return "full";
  }
  return "outcomes";
}
