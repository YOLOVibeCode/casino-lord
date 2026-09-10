import type { GameId } from "./types.js";
import type { ResultEnvelope, Series } from "./data-model.js";
import type { PlatformState } from "./platform-state.js";
import type { TableEvent } from "./events.js";
import { buildLeaderboard } from "./betting-selectors.js";

export interface ExportHeader {
  game: GameId;
  code: string;
  seriesNumber: number;
  started: string;
  source: "physical" | "virtual";
  rules: unknown;
  commit?: string;
  seed?: string;
  seriesId?: string;
}

export interface ExportPlayerRow {
  playerId: string;
  name: string;
  issued: number;
  net: number;
  final: number;
}

export interface ExportBetRow {
  roundId: string;
  playerId: string;
  betType: string;
  target?: unknown;
  amount: number;
  outcome: string;
  profit: number;
}

export interface ParsedExportEnvelope {
  header: ExportHeader;
  body: string;
  players: ExportPlayerRow[];
  bets: ExportBetRow[];
}

function seriesStarts(events: TableEvent[]): Array<{ index: number; event: TableEvent }> {
  const starts: Array<{ index: number; event: TableEvent }> = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    if (event.type === "SERIES_STARTED") {
      starts.push({ index: i, event });
    }
  }
  return starts;
}

export function sliceEventsForSeries(events: TableEvent[], seriesNumber: number): TableEvent[] {
  const starts = seriesStarts(events);
  if (starts.length === 0) {
    return events.filter((e) => e.type !== "TABLE_CREATED");
  }

  const startIdx = starts[seriesNumber - 1]?.index;
  if (startIdx === undefined) {
    return [];
  }

  const endIdx = starts[seriesNumber]?.index ?? events.length;
  return events.slice(startIdx, endIdx);
}

export function buildSeriesFromEvents<R>(
  events: TableEvent[],
  seriesNumber: number,
  _game: GameId,
): Series<R> | null {
  const starts = seriesStarts(events);
  const startEvent = starts[seriesNumber - 1]?.event;
  const slice = sliceEventsForSeries(events, seriesNumber);

  if (seriesNumber > 1 && !startEvent) {
    return null;
  }

  const startedAt =
    startEvent?.type === "SERIES_STARTED"
      ? startEvent.at
      : (events.find((e) => e.type === "TABLE_CREATED")?.at ?? new Date(0).toISOString());

  const seriesId =
    startEvent?.type === "SERIES_STARTED" ? startEvent.seriesId : `series-${seriesNumber}`;

  const results = slice
    .filter((e) => e.type === "RESULT_RECORDED")
    .map((e) => {
      if (e.type !== "RESULT_RECORDED") {
        throw new Error("unreachable");
      }
      return e.result;
    });

  const endEvent = slice.find((e) => e.type === "SERIES_ENDED");

  return {
    id: seriesId,
    number: seriesNumber,
    startedAt,
    ...(startEvent?.type === "SERIES_STARTED" && startEvent.label !== undefined
      ? { label: startEvent.label }
      : {}),
    ...(startEvent?.type === "SERIES_STARTED" && startEvent.commit !== undefined
      ? { commit: startEvent.commit }
      : {}),
    ...(endEvent?.type === "SERIES_ENDED" && endEvent.seed !== undefined
      ? { seed: endEvent.seed }
      : {}),
    results: results as ResultEnvelope<R>[],
    rounds: [],
  };
}

export function prefixEventsThroughSeries(
  events: TableEvent[],
  seriesNumber: number,
): TableEvent[] {
  const starts = seriesStarts(events);
  if (starts.length === 0) {
    return events;
  }

  const endIdx = starts[seriesNumber]?.index ?? events.length;
  return events.slice(0, endIdx);
}

export function buyInByPlayerFromEvents(events: readonly TableEvent[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const event of events) {
    if (event.type === "BANK_ISSUED") {
      map[event.playerId] = (map[event.playerId] ?? 0) + event.amount;
    }
  }
  return map;
}

export function resultIdsInSeries(events: TableEvent[], seriesNumber: number): Set<string> {
  const slice = sliceEventsForSeries(events, seriesNumber);
  const ids = new Set<string>();
  for (const event of slice) {
    if (event.type === "RESULT_RECORDED") {
      ids.add(event.result.id);
    }
  }
  return ids;
}

export function roundIdsForSeriesResults(
  platform: PlatformState,
  resultIds: Set<string>,
): Set<string> {
  const roundIds = new Set<string>();
  for (const round of platform.rounds) {
    if (round.resultId !== undefined && resultIds.has(round.resultId)) {
      roundIds.add(round.id);
    }
  }
  return roundIds;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(bytes).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlEncodeJson(value: unknown): string {
  const json = JSON.stringify(value);
  return bytesToBase64Url(new TextEncoder().encode(json));
}

function base64UrlDecodeJson(encoded: string): unknown {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary =
    typeof atob !== "undefined" ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export function encodeBetTargetForExport(betType: string, target: unknown | undefined): string {
  if (target === undefined || target === null) {
    return betType;
  }
  if (typeof target === "string" || typeof target === "number" || typeof target === "boolean") {
    return `${betType}:${String(target)}`;
  }
  return `${betType}:${base64UrlEncodeJson(target)}`;
}

function decodeBetTargetSuffix(betTypeWithTarget: string): { betType: string; target?: unknown } {
  const colon = betTypeWithTarget.indexOf(":");
  if (colon === -1) {
    return { betType: betTypeWithTarget };
  }
  const betType = betTypeWithTarget.slice(0, colon);
  const suffix = betTypeWithTarget.slice(colon + 1);
  if (/^[A-Za-z0-9_-]+$/.test(suffix) && suffix.length > 8) {
    try {
      return { betType, target: base64UrlDecodeJson(suffix) };
    } catch {
      return { betType, target: suffix };
    }
  }
  return { betType, target: suffix };
}

export function buildExportHeader(input: {
  game: GameId;
  code: string;
  seriesNumber: number;
  seriesStartedAt: string;
  source: "physical" | "virtual";
  rules: unknown;
  commit?: string;
  seed?: string;
  seriesId?: string;
}): string {
  const parts = [
    `#casino-lord v3 game=${input.game}`,
    `table=${input.code}`,
    `series=${input.seriesNumber}`,
    `started=${input.seriesStartedAt}`,
    `source=${input.source}`,
  ];
  if (input.seriesId !== undefined) {
    parts.push(`seriesId=${input.seriesId}`);
  }
  if (input.commit !== undefined) {
    parts.push(`commit=${input.commit}`);
  }
  if (input.seed !== undefined) {
    parts.push(`seed=${input.seed}`);
  }
  parts.push(`rules=${base64UrlEncodeJson(input.rules)}`);
  return parts.join(" ");
}

export function buildPlayersSection(
  platform: PlatformState,
  buyInByPlayer: Record<string, number>,
): string {
  const rows = buildLeaderboard(platform, buyInByPlayer);
  if (rows.length === 0) {
    return "";
  }
  return rows
    .map(
      (row) =>
        `${row.playerId} ${row.name} issued=${buyInByPlayer[row.playerId] ?? 0} net=${row.net} final=${row.bankroll}`,
    )
    .join("\n");
}

export function buildBetsSection(
  platform: PlatformState,
  seriesRoundIds: Set<string>,
): ExportBetRow[] {
  const rows: ExportBetRow[] = [];
  const betById = new Map(platform.bets.map((bet) => [bet.id, bet]));

  for (const roundId of [...seriesRoundIds].sort()) {
    const settlements = platform.settlements[roundId] ?? [];
    for (const settlement of settlements) {
      const bet = betById.get(settlement.betId);
      if (!bet) continue;
      rows.push({
        roundId,
        playerId: bet.playerId,
        betType: bet.type,
        ...(bet.target !== undefined ? { target: bet.target } : {}),
        amount: bet.amount,
        outcome: settlement.outcome,
        profit: settlement.profit,
      });
    }
  }

  return rows;
}

function formatBetRow(row: ExportBetRow): string {
  const typeToken = encodeBetTargetForExport(row.betType, row.target);
  return `${row.roundId} ${row.playerId} ${typeToken} ${row.amount} ${row.outcome} ${row.profit}`;
}

export function buildExportEnvelope(input: {
  game: GameId;
  code: string;
  seriesNumber: number;
  seriesStartedAt: string;
  source: "physical" | "virtual";
  rules: unknown;
  series: Series<unknown>;
  gameBody: string;
  platform: PlatformState;
  events: readonly TableEvent[];
}): string {
  const prefixEvents = prefixEventsThroughSeries([...input.events], input.seriesNumber);
  const buyInByPlayer = buyInByPlayerFromEvents(prefixEvents);
  const resultIds = resultIdsInSeries([...input.events], input.seriesNumber);
  const seriesRoundIds = roundIdsForSeriesResults(input.platform, resultIds);
  const betRows = buildBetsSection(input.platform, seriesRoundIds);

  const header = buildExportHeader({
    game: input.game,
    code: input.code,
    seriesNumber: input.seriesNumber,
    seriesStartedAt: input.seriesStartedAt,
    source: input.source,
    rules: input.rules,
    ...(input.series.id !== undefined ? { seriesId: input.series.id } : {}),
    ...(input.series.commit !== undefined ? { commit: input.series.commit } : {}),
    ...(input.series.seed !== undefined ? { seed: input.series.seed } : {}),
  });

  const playersBody = buildPlayersSection(input.platform, buyInByPlayer);
  const betsBody = betRows.map(formatBetRow).join("\n");

  const sections = [header, input.gameBody.trimEnd(), "#players"];
  if (playersBody.length > 0) {
    sections.push(playersBody);
  }
  sections.push("#bets");
  if (betsBody.length > 0) {
    sections.push(betsBody);
  }
  return sections.join("\n");
}

function parseHeaderLine(firstLine: string): ExportHeader | { error: string } {
  if (!firstLine.startsWith("#casino-lord")) {
    return { error: "Not a Casino Lord export" };
  }

  const gameMatch = firstLine.match(/game=([a-z]+)/);
  const tableMatch = firstLine.match(/table=([A-Z0-9]+)/);
  const seriesMatch = firstLine.match(/series=(\d+)/);
  const startedMatch = firstLine.match(/started=([^\s]+)/);
  const sourceMatch = firstLine.match(/source=(physical|virtual)/);
  const rulesMatch = firstLine.match(/rules=([A-Za-z0-9_-]+)/);
  const commitMatch = firstLine.match(/commit=([a-f0-9]+)/);
  const seedMatch = firstLine.match(/seed=([a-f0-9]+)/);
  const seriesIdMatch = firstLine.match(/seriesId=([^\s]+)/);

  if (!gameMatch || !tableMatch || !seriesMatch || !startedMatch || !sourceMatch || !rulesMatch) {
    return { error: "Malformed export header" };
  }

  try {
    const rules = base64UrlDecodeJson(rulesMatch[1]!);
    return {
      game: gameMatch[1] as GameId,
      code: tableMatch[1]!,
      seriesNumber: Number(seriesMatch[1]),
      started: startedMatch[1]!,
      source: sourceMatch[1] as "physical" | "virtual",
      rules,
      ...(commitMatch ? { commit: commitMatch[1] } : {}),
      ...(seedMatch ? { seed: seedMatch[1] } : {}),
      ...(seriesIdMatch ? { seriesId: seriesIdMatch[1] } : {}),
    };
  } catch {
    return { error: "Invalid rules encoding in export" };
  }
}

function parsePlayerRow(line: string): ExportPlayerRow | null {
  const match = line.match(/^(\S+)\s+(.+)\s+issued=(\d+)\s+net=(-?\d+)\s+final=(\d+)$/);
  if (!match) return null;
  return {
    playerId: match[1]!,
    name: match[2]!,
    issued: Number(match[3]),
    net: Number(match[4]),
    final: Number(match[5]),
  };
}

function parseBetRow(line: string): ExportBetRow | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 6) return null;
  const roundId = parts[0]!;
  const playerId = parts[1]!;
  const amount = Number(parts[parts.length - 3]);
  const outcome = parts[parts.length - 2]!;
  const profit = Number(parts[parts.length - 1]);
  if (!Number.isFinite(amount) || !Number.isFinite(profit)) return null;
  const betTypeWithTarget = parts.slice(2, parts.length - 3).join(" ");
  const { betType, target } = decodeBetTargetSuffix(betTypeWithTarget);
  return {
    roundId,
    playerId,
    betType,
    ...(target !== undefined ? { target } : {}),
    amount,
    outcome,
    profit,
  };
}

export function parseExportEnvelope(text: string): ParsedExportEnvelope | { error: string } {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { error: "Empty export" };
  }

  const lines = trimmed.split("\n");
  const headerParsed = parseHeaderLine(lines[0] ?? "");
  if ("error" in headerParsed) {
    return headerParsed;
  }

  const playersIndex = lines.findIndex((line) => line.trim() === "#players");
  const betsIndex = lines.findIndex((line) => line.trim() === "#bets");

  const bodyEnd = playersIndex >= 0 ? playersIndex : betsIndex >= 0 ? betsIndex : lines.length;
  const body = lines.slice(1, bodyEnd).join("\n").trimEnd();

  const players: ExportPlayerRow[] = [];
  if (playersIndex >= 0) {
    const playerEnd = betsIndex >= 0 ? betsIndex : lines.length;
    for (const line of lines.slice(playersIndex + 1, playerEnd)) {
      if (line.trim().length === 0) continue;
      const row = parsePlayerRow(line);
      if (row) players.push(row);
    }
  }

  const bets: ExportBetRow[] = [];
  if (betsIndex >= 0) {
    for (const line of lines.slice(betsIndex + 1)) {
      if (line.trim().length === 0) continue;
      const row = parseBetRow(line);
      if (row) bets.push(row);
    }
  }

  return { header: headerParsed, body, players, bets };
}

export function parseExportHeader(text: string): ExportHeader | { error: string } {
  const parsed = parseExportEnvelope(text);
  if ("error" in parsed) {
    return parsed;
  }
  return parsed.header;
}

export function parseExportForImport(text: string): ParsedExportEnvelope | { error: string } {
  return parseExportEnvelope(text);
}
