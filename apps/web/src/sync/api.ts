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
  dealerConnected?: boolean;
  joiningOpen?: boolean;
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
