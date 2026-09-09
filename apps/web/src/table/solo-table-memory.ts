import type { GameId } from "@casino-lord/core";
import { browserStorage, type StorageLike } from "../settings/storage.js";

function lastSoloKey(game: GameId): string {
  return `casino-lord:last-solo:${game}`;
}

export function getLastSoloTableCode(
  game: GameId,
  store: StorageLike | null = browserStorage(),
): string | null {
  if (!store) return null;
  return store.getItem(lastSoloKey(game));
}

export function setLastSoloTableCode(
  game: GameId,
  code: string,
  store: StorageLike | null = browserStorage(),
): void {
  if (!store) return;
  store.setItem(lastSoloKey(game), code);
}
