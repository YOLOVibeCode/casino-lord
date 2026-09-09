import { z } from "zod";

const persistSchema = z.enum(["memory", "sqlite", "redis"]);

const booleanFromEnv = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .transform((value) => value === true || value === "true");

const configSchema = z.object({
  port: z.coerce.number().int().min(0).default(3000),
  persist: persistSchema.default("sqlite"),
  staticRoot: z.string().optional(),
  sqlitePath: z.string().default("/data/casino-lord.db"),
  tableTtlHours: z.coerce.number().int().positive().default(6),
  tableRetentionDays: z.coerce.number().int().positive().default(30),
  publicUrl: z.string().optional(),
  enabledGames: z
    .string()
    .default("baccarat,roulette,craps,blackjack")
    .transform((value) =>
      value
        .split(",")
        .map((game) => game.trim())
        .filter((game) => game.length > 0),
    ),
  enablePlayerMode: booleanFromEnv.default(true),
  enableVirtual: booleanFromEnv.default(true),
  maxPlayersHard: z.coerce.number().int().positive().default(50),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config = configSchema.parse({
    port: env.PORT,
    persist: env.PERSIST,
    staticRoot: env.STATIC_ROOT,
    sqlitePath: env.SQLITE_PATH,
    tableTtlHours: env.TABLE_TTL_HOURS,
    tableRetentionDays: env.TABLE_RETENTION_DAYS,
    publicUrl: env.PUBLIC_URL,
    enabledGames: env.ENABLED_GAMES,
    enablePlayerMode: env.ENABLE_PLAYER_MODE,
    enableVirtual: env.ENABLE_VIRTUAL,
    maxPlayersHard: env.MAX_PLAYERS_HARD,
  });

  if (config.persist === "redis") {
    throw new Error("PERSIST=redis is not supported yet");
  }

  return config;
}
