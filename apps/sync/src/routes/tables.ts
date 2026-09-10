import { normalizeTableCode, validateParticipation, type TableEvent } from "@casino-lord/core";
import type { FastifyInstance } from "fastify";
import { getModule } from "../modules.js";
import type { RateLimiter } from "../rate-limit.js";
import {
  createRateLimiter,
  PLAYER_JOIN_LIMIT,
  PLAYER_JOIN_WINDOW_MS,
  TABLE_CREATE_LIMIT,
  TABLE_CREATE_WINDOW_MS,
} from "../rate-limit.js";
import { createTableBodySchema, joinPlayerBodySchema } from "../schemas/event-input.js";
import { buildExportText } from "../tables/export.js";
import { buildTableMeta } from "../tables/meta.js";
import { buildFairnessResponse, listSeriesFairness } from "../tables/fairness.js";
import { buildSeriesFromEvents, maxExportableSeries } from "../tables/series.js";
import type { TableRegistry } from "../tables/registry.js";

function clientIp(request: {
  ip: string;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim();
  }
  return request.ip;
}

function parseBearer(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice("Bearer ".length).trim() || null;
}

export interface RegisterTableRoutesOptions {
  registry: TableRegistry;
  rateLimiter?: RateLimiter;
  notifyPending?: (code: string) => void;
  broadcastEvent?: (code: string, event: TableEvent) => void;
  disconnectSockets?: (socketIds: string[]) => void;
}

export function registerTableRoutes(
  app: FastifyInstance,
  options: RegisterTableRoutesOptions,
): void {
  const { registry } = options;
  const rateLimiter = options.rateLimiter ?? createRateLimiter();

  app.post("/tables", async (request, reply) => {
    const ip = clientIp(request);
    if (!rateLimiter.tryConsume(`create:${ip}`, TABLE_CREATE_LIMIT, TABLE_CREATE_WINDOW_MS)) {
      return reply.code(429).send({ error: "rate limit exceeded" });
    }

    const parsed = createTableBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid request body" });
    }

    const participationError = validateParticipation(parsed.data.participation);
    if (participationError) {
      return reply.code(400).send({ error: participationError });
    }

    const module = getModule(parsed.data.game);
    if (!module) {
      return reply.code(400).send({ error: "UNSUPPORTED_GAME" });
    }

    try {
      const result = registry.createTable(
        parsed.data.game,
        parsed.data.participation,
        parsed.data.settings as Partial<import("@casino-lord/core").TableSettings> | undefined,
      );
      return reply.code(201).send({ code: result.code, dealerToken: result.dealerToken });
    } catch (error) {
      if (error instanceof Error && error.message === "UNSUPPORTED_GAME") {
        return reply.code(400).send({ error: "UNSUPPORTED_GAME" });
      }
      if (error instanceof Error && error.message === "VIRTUAL_DISABLED") {
        return reply.code(400).send({ error: "VIRTUAL_DISABLED" });
      }
      throw error;
    }
  });

  app.get("/tables/:code", async (request, reply) => {
    const params = request.params as { code: string };
    const code = normalizeTableCode(params.code);
    const table = registry.get(code);

    if (!table) {
      return reply.send({ exists: false });
    }

    const composed = table.getComposed();
    const module = getModule(table.game);
    if (!module) {
      return reply.code(500).send({ error: "module missing" });
    }

    const meta = buildTableMeta(composed, [...table.allEvents], module, composed.module);
    const presence = table.presence();
    const playerCount = composed.platform.players.filter((p) => p.status === "active").length;
    const activeColors = composed.platform.players
      .filter((p) => p.status !== "removed")
      .map((p) => p.color);
    const pendingColors = registry.pendingPayload(code).map((p) => p.color);
    const takenColors = [...new Set([...activeColors, ...pendingColors])];

    return reply.send({
      exists: true,
      game: table.game,
      participation: composed.platform.participation,
      seriesNumber: meta.seriesNumber,
      resultCount: meta.resultCount,
      displays: presence.displays,
      players: playerCount,
      dealerConnected: presence.dealers > 0,
      joiningOpen: composed.platform.settings.players.joiningOpen,
      takenColors,
    });
  });

  app.post("/tables/:code/players", async (request, reply) => {
    const ip = clientIp(request);
    if (!rateLimiter.tryConsume(`join:${ip}`, PLAYER_JOIN_LIMIT, PLAYER_JOIN_WINDOW_MS)) {
      return reply.code(429).send({ error: "rate limit exceeded" });
    }

    const params = request.params as { code: string };
    const code = normalizeTableCode(params.code);
    const parsed = joinPlayerBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid request body" });
    }

    const result = registry.joinPlayer(code, parsed.data.name, parsed.data.color);
    if ("error" in result) {
      switch (result.error) {
        case "NOT_FOUND":
          return reply.code(404).send({ error: "NOT_FOUND" });
        case "INVALID_NAME":
        case "INVALID_COLOR":
          return reply.code(400).send({ error: result.error });
        case "PLAYERS_DISABLED":
          return reply.code(403).send({ error: "PLAYERS_DISABLED" });
        case "SESSION_ENDED":
          return reply.code(409).send({ error: "SESSION_ENDED" });
        case "JOINING_CLOSED":
        case "TABLE_FULL":
          return reply.code(409).send({ error: result.error });
        default:
          return reply.code(400).send({ error: result.error });
      }
    }

    if (result.pending) {
      options.notifyPending?.(code);
    } else if (result.event) {
      // The join was appended to the log over REST; connected dealer/display
      // sockets only learn about it if we push it to the room (SPEC.md §17).
      options.broadcastEvent?.(code, result.event);
    }

    return reply.code(201).send({
      playerId: result.playerId,
      playerToken: result.playerToken,
      pending: result.pending,
    });
  });

  app.post("/tables/:code/players/:id/reissue", async (request, reply) => {
    const params = request.params as { code: string; id: string };
    const code = normalizeTableCode(params.code);
    const table = registry.get(code);
    if (!table) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }

    const token = parseBearer(request.headers.authorization);
    if (!token || !registry.verifyDealerToken(code, token)) {
      return reply.code(401).send({ error: "BAD_TOKEN" });
    }

    const reissued = registry.reissuePlayerToken(code, params.id);
    if (!reissued) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }

    options.disconnectSockets?.(reissued.disconnectedSocketIds);
    return reply.send({ playerToken: reissued.playerToken });
  });

  app.get("/tables/:code/export", async (request, reply) => {
    const params = request.params as { code: string };
    const query = request.query as { series?: string };
    const code = normalizeTableCode(params.code);
    const table = registry.get(code);

    if (!table) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }

    const token = parseBearer(request.headers.authorization);
    if (!token || !registry.verifyDealerToken(code, token)) {
      return reply.code(401).send({ error: "BAD_TOKEN" });
    }

    const seriesNumber = query.series ? Number.parseInt(query.series, 10) : 1;
    if (!Number.isFinite(seriesNumber) || seriesNumber < 1) {
      return reply.code(400).send({ error: "invalid series" });
    }

    const maxSeries = maxExportableSeries([...table.persistedEvents]);
    if (seriesNumber > maxSeries) {
      return reply.code(404).send({ error: "series not found" });
    }

    const module = getModule(table.game);
    if (!module) {
      return reply.code(500).send({ error: "module missing" });
    }

    const series = buildSeriesFromEvents([...table.persistedEvents], seriesNumber, table.game);
    if (!series) {
      return reply.code(404).send({ error: "series not found" });
    }

    const composed = table.getComposed();
    const text = buildExportText({
      game: table.game,
      code: table.code,
      seriesNumber,
      seriesStartedAt: series.startedAt,
      source: composed.platform.participation.outcomeSource,
      rules: table.getEffectiveRules(),
      module,
      series,
      events: table.persistedEvents,
    });

    return reply.type("text/plain").send(text);
  });

  app.get("/tables/:code/fairness", async (request, reply) => {
    const params = request.params as { code: string };
    const query = request.query as { series?: string; list?: string };
    const code = normalizeTableCode(params.code);
    const table = registry.get(code);

    if (!table) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }

    const composed = table.getComposed();
    if (composed.platform.participation.outcomeSource !== "virtual") {
      return reply.code(400).send({ error: "NOT_VIRTUAL" });
    }

    if (query.list === "1") {
      return reply.send({ series: listSeriesFairness([...table.allEvents]) });
    }

    const seriesNumber = query.series ? Number.parseInt(query.series, 10) : 1;
    if (!Number.isFinite(seriesNumber) || seriesNumber < 1) {
      return reply.code(400).send({ error: "invalid series" });
    }

    const maxSeries = maxExportableSeries([...table.allEvents]);
    if (seriesNumber > maxSeries) {
      return reply.code(404).send({ error: "series not found" });
    }

    const series = buildSeriesFromEvents([...table.allEvents], seriesNumber, table.game);
    if (!series) {
      return reply.code(404).send({ error: "series not found" });
    }

    const dealer = registry.getVirtualDealer(code);
    const drawsFromDealer = dealer?.getDrawLog().map((d) => ({ from: d.from, to: d.to })) ?? [];

    const response = buildFairnessResponse([...table.allEvents], seriesNumber, code, series.id);

    if (drawsFromDealer.length > response.draws.length) {
      return reply.send({ ...response, draws: drawsFromDealer });
    }

    return reply.send(response);
  });
}
