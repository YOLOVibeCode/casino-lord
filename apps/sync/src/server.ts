import fastifyStatic from "@fastify/static";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config.js";
import { GAMES } from "./games.js";

const DEV_VERSION = {
  version: "dev",
  commit: null,
  builtAt: null,
} as const;

export interface BuildServerOptions {
  config?: Config;
  staticRoot?: string;
}

function defaultStaticRoot(): string {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const candidates = [resolve(packageRoot, "../web/dist"), resolve(packageRoot, "apps/web/dist")];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "index.html"))) {
      return candidate;
    }
  }

  return candidates[0]!;
}

function readVersionJson(staticRoot: string): unknown {
  const versionPath = join(staticRoot, "version.json");
  if (!existsSync(versionPath)) {
    return DEV_VERSION;
  }

  return JSON.parse(readFileSync(versionPath, "utf8"));
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const staticRoot = options.staticRoot ?? defaultStaticRoot();
  const startedAt = Date.now();
  const app = Fastify({ logger: true });

  app.get("/healthz", async () => ({
    ok: true,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  }));

  app.get("/games", async () => GAMES);

  const versionPath = join(staticRoot, "version.json");
  if (!existsSync(versionPath)) {
    app.get("/version.json", async () => readVersionJson(staticRoot));
  }

  await app.register(fastifyStatic, {
    root: staticRoot,
    wildcard: false,
    setHeaders(res, filePath) {
      if (filePath.includes(`${join(staticRoot, "assets")}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return;
      }

      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  });

  app.setNotFoundHandler(async (request, reply) => {
    const pathname = request.url.split("?")[0] ?? request.url;

    if (pathname.startsWith("/assets/")) {
      return reply.code(404).send();
    }

    return reply.type("text/html").header("Cache-Control", "no-cache").sendFile("index.html");
  });

  await app.ready();
  return app;
}
