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
