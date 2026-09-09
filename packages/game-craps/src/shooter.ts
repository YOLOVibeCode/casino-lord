import type { CrapsState } from "./types.js";

export function nextShooterInOrder(
  order: string[],
  currentId: string | null,
  absentIds: string[] = [],
): string | null {
  if (order.length === 0) return null;
  const active = order.filter((id) => !absentIds.includes(id));
  if (active.length === 0) return null;
  if (currentId === null) return active[0] ?? null;
  const idx = active.indexOf(currentId);
  if (idx < 0) return active[0] ?? null;
  return active[(idx + 1) % active.length] ?? null;
}

export function assignShooter(state: CrapsState, playerId: string | null): CrapsState {
  return { ...state, currentShooterId: playerId };
}

export function passDice(state: CrapsState): CrapsState {
  if (state.phase !== "come_out") return state;
  const next = nextShooterInOrder(state.shooterOrder, state.currentShooterId);
  return { ...state, currentShooterId: next };
}

export function rotateShooterAfterSevenOut(state: CrapsState): CrapsState {
  const next = nextShooterInOrder(state.shooterOrder, state.currentShooterId);
  return { ...state, currentShooterId: next };
}
