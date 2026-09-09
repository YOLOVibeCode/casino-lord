import { formatCard, parseCardList } from "./cards.js";
import { computeDealerFromCards, resolveRoundSeats } from "./engine.js";
import {
  buildQuickResult,
  formatOutcomeLetter,
  formatQuickDealer,
  inferDepthFromLine,
  isQuickDealerToken,
  parseOutcomeLetter,
  parseQuickDealerToken,
} from "./quick-entry.js";
import type { BlackjackRules } from "./rules.js";
import type { BlackjackResult, HandInput, Seat, SeatOutcome } from "./types.js";

export interface ImportedRound {
  result: BlackjackResult;
  line: number;
  raw: string;
}

export interface ImportSuccess {
  ok: true;
  rounds: ImportedRound[];
  warnings: string[];
}

export interface ImportFailure {
  ok: false;
  errors: string[];
}

export type ImportResult = ImportSuccess | ImportFailure;

function parseHandFlags(body: string): { text: string; doubled: boolean; surrendered: boolean } {
  let text = body.trim();
  let doubled = false;
  let surrendered = false;
  if (/\bd\b/i.test(text)) {
    doubled = true;
    text = text.replace(/\bd\b/gi, "").trim();
  }
  if (/\bs\b/i.test(text)) {
    surrendered = true;
    text = text.replace(/\bs\b/gi, "").trim();
  }
  return { text, doubled, surrendered };
}

function parseSeatPart(
  part: string,
  rules: BlackjackRules,
): { seat: Seat; hands: HandInput[] } | null {
  const colon = part.indexOf(":");
  if (colon === -1) return null;
  const seatNum = Number(part.slice(0, colon));
  if (seatNum < 1 || seatNum > 7) return null;
  const seat = seatNum as Seat;
  const body = part.slice(colon + 1).trim();

  if (/^(W|L|P|BJ|B|R)$/i.test(body)) {
    const outcome = parseOutcomeLetter(body);
    if (!outcome) return null;
    return {
      seat,
      hands: [{ cards: [], doubled: false, fromSplit: false, surrendered: false, outcome }],
    };
  }

  const handParts = body
    .split(";")
    .map((h) => h.trim())
    .filter(Boolean);
  const hands: HandInput[] = handParts.map((hp) => {
    const { text, doubled, surrendered } = parseHandFlags(hp);
    if (/^(W|L|P|BJ|B|R)$/i.test(text)) {
      return {
        cards: [],
        doubled,
        fromSplit: handParts.length > 1,
        surrendered,
        outcome: parseOutcomeLetter(text),
      };
    }
    return {
      cards: parseCardList(text),
      doubled,
      fromSplit: handParts.length > 1,
      surrendered,
      outcome: null,
    };
  });

  return { seat, hands };
}

function parseLine(
  line: string,
  rules: BlackjackRules,
  lineNum: number,
): { result: BlackjackResult; warnings: string[] } {
  const parts = line.split("|").map((p) => p.trim());
  const warnings: string[] = [];
  const depth = inferDepthFromLine(parts);
  const dealerPart = parts[0] ?? "";

  if (isQuickDealerToken(dealerPart)) {
    const quick = buildQuickResult(dealerPart, rules);
    if (!quick) throw new Error(`Invalid quick dealer: ${dealerPart}`);
    return { result: quick, warnings };
  }

  if (!dealerPart.startsWith("D:")) throw new Error(`Expected dealer part D:… got ${dealerPart}`);

  const dealerCards = parseCardList(dealerPart.slice(2));
  const seats: Partial<Record<Seat, HandInput[]>> = {};

  for (const part of parts.slice(1)) {
    const parsed = parseSeatPart(part, rules);
    if (!parsed) throw new Error(`Invalid seat part: ${part}`);
    seats[parsed.seat] = parsed.hands;
  }

  let result: BlackjackResult = {
    dealer: computeDealerFromCards(dealerCards, rules),
    seats,
    depth: depth === "quick" ? "outcomes" : depth,
    dealerError: false,
  };

  if (result.depth === "full") {
    const resolved = resolveRoundSeats(seats, dealerCards, rules);
    for (const [seatKey, hands] of Object.entries(seats)) {
      const seat = Number(seatKey) as Seat;
      const entered = hands ?? [];
      const computed = resolved[seat] ?? [];
      for (let i = 0; i < entered.length; i++) {
        const e = entered[i]!;
        const c = computed[i];
        if (e.outcome && c?.outcome && e.outcome !== c.outcome) {
          warnings.push(
            `Line ${lineNum}: seat ${seat} hand ${i + 1} outcome mismatch (entered ${e.outcome}, computed ${c.outcome})`,
          );
        }
      }
    }
    result = {
      ...result,
      seats: resolved,
      dealer: computeDealerFromCards(dealerCards, rules),
    };
  }

  return { result, warnings };
}

export function importText(text: string, rules: BlackjackRules): ImportResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rounds: ImportedRound[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("#")) continue;
    try {
      const { result, warnings: w } = parseLine(line, rules, i + 1);
      warnings.push(...w);
      rounds.push({ result, line: i + 1, raw: line });
    } catch (e) {
      errors.push(`Line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, rounds, warnings };
}

function formatHand(hand: HandInput): string {
  if (hand.cards.length === 0 && hand.outcome) {
    return formatOutcomeLetter(hand.outcome);
  }
  let s = hand.cards.map(formatCard).join(",");
  if (hand.doubled) s += " d";
  if (hand.surrendered) s += " s";
  return s;
}

export function exportRound(result: BlackjackResult): string {
  if (result.depth === "quick") {
    return formatQuickDealer(result);
  }

  let dealerPart: string;
  if (result.dealer.cards.length > 0) {
    dealerPart = `D:${result.dealer.cards.map(formatCard).join(",")}`;
  } else if (result.dealer.bust) {
    dealerPart = "D:BUST";
  } else {
    dealerPart = `D:${result.dealer.total ?? ""}`;
  }

  const parts = [dealerPart];
  const seatKeys = Object.keys(result.seats)
    .map(Number)
    .sort((a, b) => a - b) as Seat[];

  for (const seat of seatKeys) {
    const hands = result.seats[seat];
    if (!hands?.length) continue;
    if (result.depth === "outcomes" && hands.every((h) => h.outcome && h.cards.length === 0)) {
      parts.push(`${seat}:${formatOutcomeLetter(hands[0]!.outcome!)}`);
    } else {
      parts.push(`${seat}:${hands.map(formatHand).join(";")}`);
    }
  }

  return parts.join(" | ");
}

export function exportSeriesText(results: BlackjackResult[]): string {
  return results.map(exportRound).join("\n");
}
