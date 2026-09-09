import { formatCard, parseCardList } from "./cards.js";
import { evaluateHand, slotsFromHands } from "./engine.js";
import { DEFAULT_BACCARAT_RULES, type BaccaratRules } from "./rules.js";
import { formatOutcomeToken, parseOutcomeToken } from "./quick-entry.js";
import type { BaccaratResult, Card, Outcome, RoadHand } from "./types.js";

export interface ImportedHand {
  result: BaccaratResult;
  roadHand: RoadHand;
  line: number;
  raw: string;
}

export interface ImportSuccess {
  ok: true;
  hands: ImportedHand[];
  warnings: string[];
}

export interface ImportFailure {
  ok: false;
  errors: string[];
}

export type ImportResult = ImportSuccess | ImportFailure;

const HEADER_PREFIX = "#casino-lord";

export function stripEnvelopeHeader(text: string): string {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.startsWith(HEADER_PREFIX)) {
    return lines.slice(1).join("\n").trim();
  }
  return text.trim();
}

export function parseBodyTokens(text: string): string[] {
  const body = stripEnvelopeHeader(text);
  return body.split(/\s+/).filter(Boolean);
}

export function parseCardedToken(token: string): {
  declaredOutcome: Outcome;
  playerPair: boolean;
  bankerPair: boolean;
  playerCards: Card[];
  bankerCards: Card[];
} {
  const colonIndex = token.indexOf(":");
  if (colonIndex === -1) throw new Error(`Invalid carded token: ${token}`);

  const outcomePart = token.slice(0, colonIndex);
  const cardsPart = token.slice(colonIndex + 1);
  const slashIndex = cardsPart.indexOf("/");
  if (slashIndex === -1) throw new Error(`Invalid carded token: ${token}`);

  const roadHand = parseOutcomeToken(outcomePart);
  const playerCards = parseCardList(cardsPart.slice(0, slashIndex));
  const bankerCards = parseCardList(cardsPart.slice(slashIndex + 1));

  return {
    declaredOutcome: roadHand.outcome,
    playerPair: roadHand.playerPair,
    bankerPair: roadHand.bankerPair,
    playerCards,
    bankerCards,
  };
}

export function importText(
  text: string,
  rules: BaccaratRules = DEFAULT_BACCARAT_RULES,
  options: { force?: boolean } = {},
): ImportResult {
  const tokens = parseBodyTokens(text);
  const hands: ImportedHand[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i]!;
    const line = i + 1;

    try {
      if (raw.includes(":")) {
        const parsed = parseCardedToken(raw);
        const slots = slotsFromHands(parsed.playerCards, parsed.bankerCards);
        const state = evaluateHand(slots, rules);

        if (state.status !== "complete" && state.status !== "invalid") {
          errors.push(`Line ${line}: incomplete hand — ${state.hint}`);
          continue;
        }

        if (state.errors.length > 0 && !options.force) {
          errors.push(`Line ${line}: ${state.errors.map((e) => e.message).join("; ")}`);
          continue;
        }

        if (!state.outcome) {
          errors.push(`Line ${line}: could not determine outcome`);
          continue;
        }

        const mismatches: string[] = [];
        if (state.outcome !== parsed.declaredOutcome) {
          mismatches.push(`outcome ${parsed.declaredOutcome} ≠ recomputed ${state.outcome}`);
        }
        if (state.playerPair !== parsed.playerPair) {
          mismatches.push(`player pair flag mismatch`);
        }
        if (state.bankerPair !== parsed.bankerPair) {
          mismatches.push(`banker pair flag mismatch`);
        }

        if (mismatches.length > 0 && !options.force) {
          errors.push(`Line ${line}: ${mismatches.join("; ")}`);
          continue;
        }

        warnings.push(...state.warnings.map((w) => `Line ${line}: ${w}`));

        hands.push({
          line,
          raw,
          roadHand: {
            outcome: state.outcome,
            playerPair: state.playerPair,
            bankerPair: state.bankerPair,
          },
          result: {
            cards: slots,
            outcome: state.outcome,
            playerTotal: state.playerTotal,
            bankerTotal: state.bankerTotal,
            playerPair: state.playerPair,
            bankerPair: state.bankerPair,
            natural: state.playerNatural || state.bankerNatural,
          },
        });
      } else {
        const roadHand = parseOutcomeToken(raw);
        hands.push({
          line,
          raw,
          roadHand,
          result: {
            cards: null,
            outcome: roadHand.outcome,
            playerTotal: null,
            bankerTotal: null,
            playerPair: roadHand.playerPair,
            bankerPair: roadHand.bankerPair,
            natural: false,
          },
        });
      }
    } catch (err) {
      errors.push(`Line ${line}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (errors.length > 0 && !options.force) {
    return { ok: false, errors };
  }

  return { ok: true, hands, warnings };
}

export function exportHands(hands: ImportedHand[]): string {
  return hands.map((h) => exportHand(h)).join(" ");
}

export function exportHand(hand: ImportedHand): string {
  if (hand.result.cards === null) {
    return formatOutcomeToken(hand.roadHand);
  }

  const slots = hand.result.cards;
  const playerCards = [slots.P1, slots.P2, slots.P3].filter(Boolean) as Card[];
  const bankerCards = [slots.B1, slots.B2, slots.B3].filter(Boolean) as Card[];
  const outcomePart = formatOutcomeToken(hand.roadHand);
  const playerPart = playerCards.map(formatCard).join(",");
  const bankerPart = bankerCards.map(formatCard).join(",");
  return `${outcomePart}:${playerPart}/${bankerPart}`;
}

export function handsToRoadHands(hands: ImportedHand[]): RoadHand[] {
  return hands.map((h) => h.roadHand);
}
