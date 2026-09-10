import { normalizeTableCode, type GameId, type Participation } from "@casino-lord/core";

export interface CreateTableBody {
  game: GameId;
  participation: Participation;
  settings?: Record<string, unknown>;
}

export interface CreateTableResponse {
  code: string;
  dealerToken: string;
}

export interface TableLookupResponse {
  exists: boolean;
  game?: GameId;
  participation?: Participation;
  seriesNumber?: number;
  resultCount?: number;
  displays?: number;
  players?: number;
  playerColors?: string[];
  dealerConnected?: boolean;
  joiningOpen?: boolean;
  takenColors?: string[];
}

export interface JoinPlayerBody {
  name: string;
  color: string;
}

export interface JoinPlayerResponse {
  playerId: string;
  playerToken: string;
  pending: boolean;
}

export interface ReissuePlayerResponse {
  playerToken: string;
}

export async function createTable(
  baseUrl: string,
  body: CreateTableBody,
): Promise<CreateTableResponse> {
  const response = await fetch(`${baseUrl}/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`create table failed: ${response.status}`);
  }
  return (await response.json()) as CreateTableResponse;
}

export async function getTableMeta(baseUrl: string, rawCode: string): Promise<TableLookupResponse> {
  const code = normalizeTableCode(rawCode);
  const response = await fetch(`${baseUrl}/tables/${code}`);
  if (!response.ok) {
    throw new Error(`table lookup failed: ${response.status}`);
  }
  return (await response.json()) as TableLookupResponse;
}

export async function joinTablePlayer(
  baseUrl: string,
  rawCode: string,
  body: JoinPlayerBody,
): Promise<JoinPlayerResponse> {
  const code = normalizeTableCode(rawCode);
  const response = await fetch(`${baseUrl}/tables/${code}/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `join failed: ${response.status}`);
  }
  return (await response.json()) as JoinPlayerResponse;
}

export async function fetchTableExport(
  baseUrl: string,
  rawCode: string,
  seriesNumber: number,
  dealerToken: string,
): Promise<string> {
  const code = normalizeTableCode(rawCode);
  const response = await fetch(`${baseUrl}/tables/${code}/export?series=${seriesNumber}`, {
    headers: { Authorization: `Bearer ${dealerToken}` },
  });
  if (!response.ok) {
    throw new Error(`export failed: ${response.status}`);
  }
  return response.text();
}

export async function reissuePlayerToken(
  baseUrl: string,
  rawCode: string,
  playerId: string,
  dealerToken: string,
): Promise<ReissuePlayerResponse> {
  const code = normalizeTableCode(rawCode);
  const response = await fetch(`${baseUrl}/tables/${code}/players/${playerId}/reissue`, {
    method: "POST",
    headers: { Authorization: `Bearer ${dealerToken}` },
  });
  if (!response.ok) {
    throw new Error(`reissue failed: ${response.status}`);
  }
  return (await response.json()) as ReissuePlayerResponse;
}

export async function fetchServerFeatures(baseUrl: string): Promise<{ enableVirtual: boolean }> {
  try {
    const response = await fetch(`${baseUrl}/healthz`);
    if (!response.ok) {
      return { enableVirtual: false };
    }
    const data = (await response.json()) as { enableVirtual?: boolean };
    return { enableVirtual: data.enableVirtual === true };
  } catch {
    return { enableVirtual: false };
  }
}

export async function fetchVersion(baseUrl: string): Promise<string> {
  try {
    const response = await fetch(`${baseUrl}/version.json`);
    if (!response.ok) return "unknown";
    const data = (await response.json()) as { version?: string };
    return data.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
