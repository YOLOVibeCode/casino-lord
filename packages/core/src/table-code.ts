/**
 * Table codes (SPEC.md §8.1): 6 characters from an unambiguous alphabet.
 * No 0/O or 1/I so a code read aloud across a bar cannot be misheard.
 */
export const TABLE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TABLE_CODE_LENGTH = 6;

const ALPHABET_SET = new Set(TABLE_CODE_ALPHABET);

/** Uppercases and strips whitespace/hyphens so `k7x2-pq` → `K7X2PQ`. */
export function normalizeTableCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isValidTableCode(input: string): boolean {
  const code = normalizeTableCode(input);
  if (code.length !== TABLE_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!ALPHABET_SET.has(ch)) return false;
  }
  return true;
}

/**
 * Builds a code from a source of uniform random integers. The caller supplies
 * randomness so this stays pure and testable (SPEC.md §6.1).
 */
export function tableCodeFrom(nextInt: (maxExclusive: number) => number): string {
  let code = "";
  for (let i = 0; i < TABLE_CODE_LENGTH; i++) {
    const idx = nextInt(TABLE_CODE_ALPHABET.length);
    if (!Number.isInteger(idx) || idx < 0 || idx >= TABLE_CODE_ALPHABET.length) {
      throw new RangeError(
        `nextInt returned ${idx}; expected 0..${TABLE_CODE_ALPHABET.length - 1}`,
      );
    }
    code += TABLE_CODE_ALPHABET[idx];
  }
  return code;
}
