import type { GameId, Participation } from "@casino-lord/core";
import type { StorageLike } from "../settings/storage.js";
import { browserStorage } from "../settings/storage.js";
import { loadTable, loadVirtualState } from "./persistence.js";
import type { UntypedGameModule } from "./module-types.js";
import { getLastSoloTableCode, setLastSoloTableCode } from "./solo-table-memory.js";
import { createTableStore, reopenTableStore, type TableStore } from "./store.js";

export interface OpenSoloTableOptions {
  game: GameId;
  module: UntypedGameModule;
  rules: unknown;
  participation?: Participation;
  store?: StorageLike | null;
  loadTable?: typeof loadTable;
  rng?: () => number;
  now?: () => string;
  id?: () => string;
}

function resolveStore(options: OpenSoloTableOptions): StorageLike | null {
  return options.store === undefined ? browserStorage() : options.store;
}

export async function resolveSoloTableStore(options: OpenSoloTableOptions): Promise<TableStore> {
  const store = resolveStore(options);
  const load = options.loadTable ?? loadTable;
  const lastCode = getLastSoloTableCode(options.game, store);

  if (lastCode) {
    const loaded = await load(lastCode);
    if (loaded && loaded.events.length > 0) {
      const virtualState = await loadVirtualState(lastCode);
      const reopened = reopenTableStore({
        code: lastCode,
        game: options.game,
        module: options.module,
        rules: options.rules,
        events: loaded.events,
        virtualState,
        ...(options.now !== undefined ? { now: options.now } : {}),
        ...(options.id !== undefined ? { id: options.id } : {}),
      });
      setLastSoloTableCode(options.game, reopened.code, store);
      return reopened;
    }
  }

  const created = createTableStore({
    game: options.game,
    module: options.module,
    rules: options.rules,
    ...(options.participation !== undefined ? { participation: options.participation } : {}),
    ...(options.rng !== undefined ? { rng: options.rng } : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
    ...(options.id !== undefined ? { id: options.id } : {}),
  });
  setLastSoloTableCode(options.game, created.code, store);
  return created;
}

export async function createNewSoloTable(options: OpenSoloTableOptions): Promise<TableStore> {
  const store = resolveStore(options);
  const created = createTableStore({
    game: options.game,
    module: options.module,
    rules: options.rules,
    ...(options.participation !== undefined ? { participation: options.participation } : {}),
    ...(options.rng !== undefined ? { rng: options.rng } : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
    ...(options.id !== undefined ? { id: options.id } : {}),
  });
  setLastSoloTableCode(options.game, created.code, store);
  return created;
}
