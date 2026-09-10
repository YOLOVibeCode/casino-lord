/** Parse comma-separated positive integers for bank.chipDenominations. */
export function parseChipDenominations(raw: string): number[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(",").map((p) => p.trim());
  if (parts.some((p) => p === "")) return null;

  const values: number[] = [];
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n <= 0) return null;
    values.push(n);
  }

  return values.length > 0 ? values : null;
}
