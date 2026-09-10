import {
  bytesToHex,
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
import { decodeSeedFromStorage, encodeSeedForStorage } from "../persistence/seed-crypto.js";
import type { TableRepository, TableRow } from "../persistence/repository.js";
import { type AdmitPlayerResult, type JoinPlayerResult, PlayerService } from "./player-service.js";
import { generateDealerToken, hashToken } from "./token.js";
import { TableInstance } from "./table-instance.js";
import { VirtualActionTimer } from "./action-timer.js";
import type { VirtualExecutorTimingDeps } from "./virtual-executor.js";
import { VirtualDealer } from "./virtual-dealer.js";

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
  virtualExecutorTiming?: VirtualExecutorTimingDeps;
}

export class TableRegistry {
  private readonly config: Config;
  private readonly repository: TableRepository;
  private readonly playerService: PlayerService;
  private readonly now: () => string;
  private readonly rng: () => number;
  private readonly virtualExecutorTiming: VirtualExecutorTimingDeps;
  private readonly tables = new Map<string, TableInstance>();
  private readonly virtualDealers = new Map<string, VirtualDealer>();
  private readonly actionTimers = new Map<string, VirtualActionTimer>();
  private readonly idleTimer: ReturnType<typeof setInterval>;
  private readonly retentionTimer: ReturnType<typeof setInterval>;

  constructor(deps: TableRegistryDeps) {
    this.config = deps.config;
    this.repository = deps.repository;
    this.playerService = new PlayerService(this.config, this.repository);
    this.now = deps.now ?? (() => new Date().toISOString());
    this.rng = deps.rng ?? (() => randomBytes(4).readUInt32BE(0));
    this.virtualExecutorTiming = deps.virtualExecutorTiming ?? {};

    for (const row of this.repository.listTables()) {
      const module = getModule(row.game);
      if (!module) {
        continue;
      }
      const events = this.repository.loadEvents(row.code);
      const table = new TableInstance(row, module, resolveRules(row.game), events, row.lastSeenAt);
      this.tables.set(row.code, table);
      this.restoreVirtualDealer(row, events);
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

    if (participation.outcomeSource === "virtual") {
      if (!this.config.enableVirtual) {
        throw new Error("VIRTUAL_DISABLED");
      }
      if (!module.virtual) {
        throw new Error("UNSUPPORTED_GAME");
      }
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

    if (participation.outcomeSource === "virtual") {
      const seriesId = crypto.randomUUID();
      const dealer = new VirtualDealer(code, seriesId);
      this.virtualDealers.set(code, dealer);
      this.persistVirtualDealer(code);
      const seriesEvent = dealer.startSeriesEvent(module.seriesLabel);
      const seriesAppended = table.appendEvent(seriesEvent, `server-series-${code}`, at);
      if (seriesAppended.kind !== "new") {
        throw new Error("unexpected duplicate on series start");
      }
      this.repository.saveEvent(code, seriesAppended.event);
    }

    this.tables.set(code, table);
    return { code, dealerToken, table };
  }

  getVirtualDealer(code: string): VirtualDealer | null {
    return this.virtualDealers.get(code) ?? null;
  }

  getVirtualExecutorTiming(): VirtualExecutorTimingDeps {
    return this.virtualExecutorTiming;
  }

  persistVirtualDealer(code: string): void {
    const dealer = this.virtualDealers.get(code);
    if (!dealer) {
      return;
    }
    const blob = encodeSeedForStorage(this.config.seedKey, dealer.getSeedBytes());
    this.repository.saveVirtualSeed(code, dealer.seriesId, blob);
  }

  dealerRotateVirtualSeries(
    code: string,
    opts: { label?: string; auto?: boolean },
  ): Omit<TableEvent, "seq" | "at">[] | null {
    const dealer = this.virtualDealers.get(code);
    if (!dealer) {
      return null;
    }
    return dealer.rotateSeries(opts.auto ?? false, opts.label);
  }

  private restoreVirtualDealer(row: TableRow, events: TableEvent[]): void {
    if (row.participation.outcomeSource !== "virtual") {
      return;
    }

    const starts = events.filter((e) => e.type === "SERIES_STARTED");
    const latest = starts[starts.length - 1];
    if (!latest || latest.type !== "SERIES_STARTED") {
      return;
    }

    const blob = this.repository.getVirtualSeed(row.code, latest.seriesId);
    if (!blob) {
      return;
    }

    const seedBytes = decodeSeedFromStorage(this.config.seedKey, blob);
    const dealer = VirtualDealer.fromSeed(row.code, latest.seriesId, bytesToHex(seedBytes));
    this.virtualDealers.set(row.code, dealer);
  }

  getActionTimer(code: string): VirtualActionTimer {
    let timer = this.actionTimers.get(code);
    if (!timer) {
      timer = new VirtualActionTimer();
      this.actionTimers.set(code, timer);
    }
    return timer;
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

  joinPlayer(code: string, name: string, color: string): JoinPlayerResult | { error: string } {
    const table = this.get(code);
    if (!table) {
      return { error: "NOT_FOUND" };
    }
    const at = this.now();
    const result = this.playerService.joinPlayer(table, name, color, at);
    if ("error" in result) {
      return result;
    }
    if (result.event) {
      this.persistEvent(code, result.event);
    }
    table.touch(at);
    this.repository.updateLastSeen(code, at);
    return result;
  }

  admitPlayer(code: string, playerId: string, accept: boolean): AdmitPlayerResult {
    const table = this.get(code);
    if (!table) {
      return { ok: false, error: "NOT_FOUND" };
    }
    const at = this.now();
    const result = this.playerService.admitPlayer(table, playerId, accept, at);
    if (result.ok && result.event) {
      this.persistEvent(code, result.event);
    }
    if (result.ok) {
      table.touch(at);
      this.repository.updateLastSeen(code, at);
    }
    return result;
  }

  reissuePlayerToken(
    code: string,
    playerId: string,
  ): { playerToken: string; disconnectedSocketIds: string[] } | null {
    const table = this.get(code);
    if (!table) {
      return null;
    }
    const result = this.playerService.reissueToken(table, playerId);
    if (!result) {
      return null;
    }
    const disconnectedSocketIds = table.disconnectPlayerSockets(playerId);
    return { playerToken: result.playerToken, disconnectedSocketIds };
  }

  verifyPlayerToken(code: string, token: string) {
    const table = this.get(code);
    if (!table) {
      return null;
    }
    return this.playerService.verifyPlayerToken(table, token);
  }

  getPendingPlayers(code: string) {
    return this.playerService.getPendingPlayers(code);
  }

  pendingPayload(code: string) {
    return this.playerService.pendingPayload(code);
  }

  deleteTable(code: string): void {
    this.actionTimers.get(code)?.cancel();
    this.actionTimers.delete(code);
    this.tables.delete(code);
    this.virtualDealers.delete(code);
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
