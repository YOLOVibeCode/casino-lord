import {
  createSeededRng,
  hexToBytes,
  replay,
  triggerForKind,
  verifyCommit,
  type GameId,
  type TableEvent,
} from "@casino-lord/core";
import type { UntypedGameModule } from "../table/module-types.js";
import { getGame } from "../table/games.js";

export interface ParsedExportHeader {
  game: GameId;
  code: string;
  seriesNumber: number;
  source: "physical" | "virtual";
  rules: unknown;
}

export interface ReplayResult {
  index: number;
  match: boolean;
  expected?: unknown;
  actual?: unknown;
}

export interface VerifyOutcome {
  commitValid: boolean;
  replays: ReplayResult[];
}

export function parseExportHeader(text: string): ParsedExportHeader | { error: string } {
  const firstLine = text.trim().split("\n")[0] ?? "";
  if (!firstLine.startsWith("#casino-lord")) {
    return { error: "Not a Casino Lord export" };
  }
  const gameMatch = firstLine.match(/game=([a-z]+)/);
  const tableMatch = firstLine.match(/table=([A-Z0-9]+)/);
  const seriesMatch = firstLine.match(/series=(\d+)/);
  const sourceMatch = firstLine.match(/source=(physical|virtual)/);
  const rulesMatch = firstLine.match(/rules=([A-Za-z0-9_-]+)/);
  if (!gameMatch || !tableMatch || !seriesMatch || !sourceMatch || !rulesMatch) {
    return { error: "Malformed export header" };
  }
  try {
    const rulesJson = rulesMatch[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = rulesJson + "=".repeat((4 - (rulesJson.length % 4)) % 4);
    const rules = JSON.parse(atob(padded)) as unknown;
    return {
      game: gameMatch[1] as GameId,
      code: tableMatch[1]!,
      seriesNumber: Number(seriesMatch[1]),
      source: sourceMatch[1] as "physical" | "virtual",
      rules,
    };
  } catch {
    return { error: "Invalid rules encoding in export" };
  }
}

export function replayVirtualSeries(input: {
  module: UntypedGameModule;
  rules: unknown;
  code: string;
  seriesId: string;
  seedHex: string;
  expectedData: unknown[];
}): VerifyOutcome {
  const rng = createSeededRng(hexToBytes(input.seedHex));
  let session: unknown = null;
  let state = input.module.initialState(input.rules);
  const replays: ReplayResult[] = [];

  if (!input.module.virtual) {
    return { commitValid: false, replays: [] };
  }

  const trigger = triggerForKind(input.module.virtual.kind);

  for (let index = 0; index < input.expectedData.length; index++) {
    const out = input.module.virtual.step({
      state,
      rules: input.rules,
      rng,
      trigger,
      session,
      seriesId: input.seriesId,
    });
    session = out.session ?? session;

    const recorded = out.events.find((e) => e.type === "RESULT_RECORDED") as
      Extract<TableEvent, { type: "RESULT_RECORDED" }> | undefined;
    const actual = recorded?.result.data;
    const expected = input.expectedData[index];
    replays.push({
      index,
      match: JSON.stringify(actual) === JSON.stringify(expected),
      expected,
      actual,
    });

    for (const event of out.events) {
      if (event.type === "LIVE_INPUT" || event.type === "VIRTUAL_PENDING") continue;
      state = input.module.reduce(state, event as TableEvent, input.rules);
    }
  }

  return { commitValid: true, replays };
}

export function replayVirtualDraws(input: {
  module: UntypedGameModule;
  rules: unknown;
  seriesId: string;
  seedHex: string;
  expectedDraws: Array<{ from: number; to: number }>;
}): ReplayResult[] {
  const rng = createSeededRng(hexToBytes(input.seedHex));
  let session: unknown = null;
  let state = input.module.initialState(input.rules);
  const replays: ReplayResult[] = [];

  if (!input.module.virtual) {
    return replays;
  }

  const trigger = triggerForKind(input.module.virtual.kind);

  for (let index = 0; index < input.expectedDraws.length; index++) {
    const out = input.module.virtual.step({
      state,
      rules: input.rules,
      rng,
      trigger,
      session,
      seriesId: input.seriesId,
    });
    session = out.session ?? session;

    const recorded = out.events.find((e) => e.type === "RESULT_RECORDED") as
      Extract<TableEvent, { type: "RESULT_RECORDED" }> | undefined;
    const actual = recorded?.result.rng;
    const expected = input.expectedDraws[index];
    const match =
      actual !== undefined &&
      expected !== undefined &&
      actual.from === expected.from &&
      actual.to === expected.to;
    replays.push({ index, match, expected, actual });

    for (const event of out.events) {
      if (event.type === "LIVE_INPUT" || event.type === "VIRTUAL_PENDING") continue;
      state = input.module.reduce(state, event as TableEvent, input.rules);
    }
  }

  return replays;
}

export function verifyFromFairnessApi(input: {
  code: string;
  seriesId: string;
  commit: string;
  seedHex: string;
  game: GameId;
  rules: unknown;
  expectedDraws: Array<{ from: number; to: number }>;
}): VerifyOutcome {
  const entry = getGame(input.game);
  if (!entry?.module) {
    return { commitValid: false, replays: [] };
  }
  const commitValid = verifyCommit(
    hexToBytes(input.seedHex),
    input.code,
    input.seriesId,
    input.commit,
  );
  const replays = replayVirtualDraws({
    module: entry.module,
    rules: input.rules,
    seriesId: input.seriesId,
    seedHex: input.seedHex,
    expectedDraws: input.expectedDraws,
  });
  return { commitValid, replays };
}

export function extractResultsFromEvents(
  events: TableEvent[],
  module: UntypedGameModule,
  rules: unknown,
): unknown[] {
  const composed = replay(events, module, rules, { code: "VERIFY", includeEphemeral: false });
  const results = (composed.module as { results?: Array<{ data: unknown }> }).results ?? [];
  return results.map((r) => r.data);
}
