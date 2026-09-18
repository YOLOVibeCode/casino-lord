export interface RateLimiter {
  tryConsume(key: string, limit: number, windowMs: number): boolean;
}

export function createRateLimiter(now: () => number = () => Date.now()): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    tryConsume(key: string, limit: number, windowMs: number): boolean {
      const t = now();
      const existing = buckets.get(key);
      if (!existing || t >= existing.resetAt) {
        buckets.set(key, { count: 1, resetAt: t + windowMs });
        return true;
      }
      if (existing.count >= limit) {
        return false;
      }
      existing.count += 1;
      return true;
    },
  };
}

export const TABLE_CREATE_LIMIT = 5;
export const TABLE_CREATE_WINDOW_MS = 60_000;
export const DEALER_EVENT_LIMIT = 20;
export const DEALER_EVENT_WINDOW_MS = 1_000;
export const PLAYER_EVENT_LIMIT = 10;
export const PLAYER_EVENT_WINDOW_MS = 1_000;
/**
 * Every guest at a table is normally behind one NAT (the venue's wifi), so the
 * whole room shares a single `join:<ip>` bucket. The limit has to clear the
 * table's own capacity (maxPlayers 20, hard cap 50) with room for re-scans and
 * reloads, or a full table cannot finish onboarding.
 */
export const PLAYER_JOIN_LIMIT = 60;
export const PLAYER_JOIN_WINDOW_MS = 60_000;
export const VIRTUAL_TRIGGER_LIMIT = 2;
export const VIRTUAL_TRIGGER_WINDOW_MS = 1_000;
