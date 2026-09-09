import {
  DEFAULT_TABLE_SETTINGS,
  isPersistedEvent,
  mergeTableSettings,
  tableCodeFrom,
  type GameId,
  type Participation,
  type TableEvent,
  type TableSettings,
} from "@casino-lord/core";
import { randomBytes } from "node:crypto";
import type { Config } from "../config.js";
import { getModule, isGameEnabled, resolveRules } from "../modules.js";
import type { TableRepository, TableRow } from "../persistence/repository.js";
import { generateDealerToken, hashToken } from "./token.js";
import { TableInstance } from "./table-instance.js";

export interface CreateTableResult {
  code: string;
  dealerToken: string;
  table: TableInstance;
}

export interface TableRegistryDeps {
  config: Config;
  repository: TableRepository;
  now?: () => string;
  rng?: () => number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export class TableRegistry {
  private readonly config: Config;
  private readonly repository: TableRepository;
  private readonly now: () => string;
  private readonly rng: () => number;
  private readonly tables = new Map<string, TableInstance>();
  private readonly idleTimer: ReturnType<typeof setInterval>;
  private readonly retentionTimer: ReturnType<typeof setInterval>;

  constructor(deps: TableRegistryDeps) {
    this.config = deps.config;
    this.repository = deps.repository;
    this.now = deps.now ?? (() => new Date().toISOString());
    this.rng = deps.rng ?? (() => randomBytes(4).readUInt32BE(0));

    for (const row of this.repository.listTables()) {
      const module = getModule(row.game);
      if (!module) {
        continue;
      }
      const events = this.repository.loadEvents(row.code);
      this.tables.set(
        row.code,
        new TableInstance(row, module, resolveRules(row.game), events, row.lastSeenAt),
      );
    }

    const setIntervalFn = deps.setIntervalFn ?? setInterval;
    const clearIntervalFn = deps.clearIntervalFn ?? clearInterval;

    this.idleTimer = setIntervalFn(() => this.purgeIdle(), 60_000);
    this.retentionTimer = setIntervalFn(() => this.purgeRetention(), 86_400_000);

    this.purgeRetention();
  }

  stop(): void {
    clearInterval(this.idleTimer);
    clearInterval(this.retentionTimer);
  }

  get(code: string): TableInstance | null {
    return this.tables.get(code) ?? null;
  }

  createTable(
    game: GameId,
    participation: Participation,
    settingsPatch?: Partial<TableSettings>,
  ): CreateTableResult {
    if (!isGameEnabled(this.config, game)) {
      throw new Error("UNSUPPORTED_GAME");
    }

    const module = getModule(game);
    if (!module) {
      throw new Error("UNSUPPORTED_GAME");
    }

    const dealerToken = generateDealerToken();
    const dealerTokenHash = hashToken(dealerToken);
    const at = this.now();

    let code: string;
    let attempts = 0;
    do {
      code = tableCodeFrom(() => this.rng() % 32);
      attempts += 1;
      if (attempts > 100) {
        throw new Error("failed to allocate table code");
      }
    } while (this.repository.hasCode(code) || this.tables.has(code));

    const settings: TableSettings = mergeTableSettings(DEFAULT_TABLE_SETTINGS, {
      participation,
      ...(settingsPatch ?? {}),
    });

    const row: TableRow = {
      code,
      game,
      participation,
      dealerTokenHash,
      createdAt: at,
      lastSeenAt: at,
    };

    this.repository.createTable(row);

    const table = new TableInstance(row, module, resolveRules(game));
    const createdEvent = {
      type: "TABLE_CREATED" as const,
      game,
      participation,
      settings,
    };

    const appended = table.appendEvent(createdEvent, `server-create-${code}`, at);
    if (appended.kind !== "new") {
      throw new Error("unexpected duplicate on create");
    }
    this.repository.saveEvent(code, appended.event);

    this.tables.set(code, table);
    return { code, dealerToken, table };
  }

  persistEvent(code: string, event: TableEvent): void {
    if (isPersistedEvent(event)) {
      this.repository.saveEvent(code, event);
    }
    this.repository.updateLastSeen(code, event.at);
  }

  verifyDealerToken(code: string, token: string): boolean {
    const row = this.repository.getTable(code);
    if (!row) {
      return false;
    }
    return hashToken(token) === row.dealerTokenHash;
  }

  deleteTable(code: string): void {
    this.tables.delete(code);
    this.repository.deleteTable(code);
  }

  purgeIdle(): void {
    const cutoffMs = Date.now() - this.config.tableTtlHours * 60 * 60 * 1000;
    const cutoffIso = new Date(cutoffMs).toISOString();

    for (const [code, table] of this.tables) {
      if (!table.hasConnectedSockets() && table.getLastActivityAt() < cutoffIso) {
        this.deleteTable(code);
      }
    }
  }

  purgeRetention(): void {
    const cutoffMs = Date.now() - this.config.tableRetentionDays * 24 * 60 * 60 * 1000;
    const cutoffIso = new Date(cutoffMs).toISOString();
    const purged = this.repository.purgeOlderThan(cutoffIso);
    if (purged > 0) {
      for (const code of [...this.tables.keys()]) {
        if (!this.repository.getTable(code)) {
          this.tables.delete(code);
        }
      }
    }
  }
}
