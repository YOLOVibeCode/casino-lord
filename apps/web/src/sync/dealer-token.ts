const PREFIX = "casino-lord:dealer-token:";

export interface DealerTokenRecord {
  code: string;
  token: string;
  game?: string;
  lastOpenedAt: number;
}

interface StoredDealerToken {
  token: string;
  game?: string;
  lastOpenedAt?: number;
}

function storage(): Storage | null {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function keyFor(code: string): string {
  return `${PREFIX}${code}`;
}

function parseStored(raw: string | null): StoredDealerToken | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDealerToken;
    if (typeof parsed.token === "string") return parsed;
  } catch {
    // legacy plain token string
  }
  return { token: raw };
}

export function saveDealerToken(code: string, token: string, meta?: { game?: string }): void {
  const store = storage();
  if (!store) return;
  const existing = parseStored(store.getItem(keyFor(code)));
  const game = meta?.game ?? existing?.game;
  const record: StoredDealerToken = {
    token,
    lastOpenedAt: Date.now(),
    ...(game !== undefined ? { game } : {}),
  };
  store.setItem(keyFor(code), JSON.stringify(record));
}

export function loadDealerToken(code: string): string | null {
  return parseStored(storage()?.getItem(keyFor(code)) ?? null)?.token ?? null;
}

export function clearDealerToken(code: string): void {
  storage()?.removeItem(keyFor(code));
}

export const forgetDealerTable = clearDealerToken;

export function listRecentDealerTables(): DealerTokenRecord[] {
  const store = storage();
  if (!store) return [];
  const rows: DealerTokenRecord[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    const code = key.slice(PREFIX.length);
    const parsed = parseStored(store.getItem(key));
    if (!parsed?.token) continue;
    rows.push({
      code,
      token: parsed.token,
      ...(parsed.game !== undefined ? { game: parsed.game } : {}),
      lastOpenedAt: parsed.lastOpenedAt ?? 0,
    });
  }
  return rows.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}
