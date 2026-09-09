import { loadConfig } from "./config.js";
import { createRepository } from "./persistence/index.js";
import { buildServer } from "./server.js";
import { TableRegistry } from "./tables/registry.js";

const config = loadConfig();
const repository = createRepository(config);
const registry = new TableRegistry({ config, repository });
const { app, io } = await buildServer({ config, registry });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  registry.stop();
  io?.close();
  await app.close();
  process.exit(0);
};

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

await app.listen({ port: config.port, host: "0.0.0.0" });
