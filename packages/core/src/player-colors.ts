/** 12-colour player palette (SPEC.md §22). */
export const PLAYER_COLORS = [
  "#E53935",
  "#FB8C00",
  "#FDD835",
  "#43A047",
  "#00ACC1",
  "#1E88E5",
  "#8E24AA",
  "#D81B60",
  "#6D4C41",
  "#546E7A",
  "#FF7043",
  "#26A69A",
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

const COLOR_SET = new Set<string>(PLAYER_COLORS);

export function isValidPlayerColor(color: string): color is PlayerColor {
  return COLOR_SET.has(color);
}

export function validatePlayerName(
  raw: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim();
  if (name.length < 2 || name.length > 16) {
    return { ok: false, error: "name must be 2–16 characters" };
  }
  if (/[<>&]/.test(name)) {
    return { ok: false, error: "name contains invalid characters" };
  }
  return { ok: true, name };
}
