import type { Config } from "../config.js";
import { createMemoryRepository } from "./memory.js";
import { createSqliteRepository } from "./sqlite.js";
import type { TableRepository } from "./repository.js";

export type { TableRepository, TableRow } from "./repository.js";

export function createRepository(config: Config): TableRepository {
  if (config.persist === "sqlite") {
    return createSqliteRepository(config.sqlitePath);
  }
  return createMemoryRepository();
}
