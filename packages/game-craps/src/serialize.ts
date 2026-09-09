import { normalizeResult } from "./engine.js";
import { DEFAULT_CRAPS_RULES, type CrapsRules } from "./rules.js";
import type { CrapsResult, Face } from "./types.js";

export interface ImportSuccess {
  ok: true;
  results: CrapsResult[];
  warnings: string[];
}

export interface ImportFailure {
  ok: false;
  errors: string[];
}

export type ImportResult = ImportSuccess | ImportFailure;

export function exportRoll(result: CrapsResult): string {
  if (result.a !== null && result.b !== null) {
    return `${result.a}-${result.b}`;
  }
  if (result.hard === true) {
    return `${result.total}H`;
  }
  return String(result.total);
}

export function parseToken(token: string): CrapsResult | "boundary" {
  if (token === "|") return "boundary";

  const hardMatch = /^(\d{1,2})H$/.exec(token);
  if (hardMatch) {
    const total = Number(hardMatch[1]);
    return normalizeResult({ a: null, b: null, total, hard: true });
  }

  const faceMatch = /^([1-6])-([1-6])$/.exec(token);
  if (faceMatch) {
    const a = Number(faceMatch[1]) as Face;
    const b = Number(faceMatch[2]) as Face;
    return normalizeResult({ a, b });
  }

  const total = Number(token);
  if (!Number.isInteger(total) || total < 2 || total > 12) {
    throw new Error(`Invalid roll token: ${token}`);
  }
  return normalizeResult({ a: null, b: null, total });
}

export function parseBodyTokens(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function importText(text: string, rules: CrapsRules = DEFAULT_CRAPS_RULES): ImportResult {
  const warnings: string[] = [];
  const results: CrapsResult[] = [];
  let lastWasSevenOut = false;

  try {
    for (const token of parseBodyTokens(text)) {
      const parsed = parseToken(token);
      if (parsed === "boundary") {
        if (lastWasSevenOut && rules.autoNewShooterOnSevenOut) {
          lastWasSevenOut = false;
        } else if (lastWasSevenOut) {
          warnings.push("Seven-out not followed by shooter boundary");
        }
        continue;
      }

      results.push(parsed);
      lastWasSevenOut = parsed.total === 7;
    }

    if (lastWasSevenOut && rules.autoNewShooterOnSevenOut) {
      warnings.push("Seven-out at end without shooter boundary");
    }
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)] };
  }

  return { ok: true, results, warnings };
}
