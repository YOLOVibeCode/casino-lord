import { useCallback, useEffect, useState } from "preact/hooks";
import { useRoute } from "preact-iso";
import { useDeviceSettings } from "../hooks/use-device-settings.js";
import { DealerShell } from "../shells/DealerShell.js";
import { DisplayShell } from "../shells/DisplayShell.js";
import { useStore } from "../hooks/use-store.js";
import { getGame } from "../table/games.js";
import { createNewSoloTable, resolveSoloTableStore } from "../table/solo-table.js";
import type { TableStore } from "../table/store.js";
import "./solo.css";

export function SoloPage(_props: { path?: string }) {
  const { params } = useRoute();
  const gameId = params.game ?? "";
  const entry = getGame(gameId);
  const [store, setStore] = useState<TableStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceSettings, setDeviceSettings] = useDeviceSettings();

  useEffect(() => {
    if (!entry?.enabled || !entry.module) {
      setStore(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void resolveSoloTableStore({
      game: entry.id,
      module: entry.module,
      rules: entry.module.defaultRules,
    }).then((resolved) => {
      if (!cancelled) {
        setStore(resolved);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [entry]);

  const handleNewTable = useCallback(async () => {
    if (!entry?.enabled || !entry.module) return;
    const next = await createNewSoloTable({
      game: entry.id,
      module: entry.module,
      rules: entry.module.defaultRules,
    });
    setStore(next);
  }, [entry]);

  if (!entry) {
    return (
      <main class="solo solo--error">
        <p>Unknown game.</p>
        <a href="/">Back</a>
      </main>
    );
  }

  if (!entry.enabled) {
    return (
      <main class="solo solo--error">
        <p>{entry.name} is coming soon.</p>
        <a href="/">Back</a>
      </main>
    );
  }

  if (loading || !store) {
    return (
      <main class="solo">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <SoloPanes
      store={store}
      entry={entry}
      deviceSettings={deviceSettings}
      setDeviceSettings={setDeviceSettings}
      onNewTable={() => void handleNewTable()}
    />
  );
}

function SoloPanes({
  store,
  entry,
  deviceSettings,
  setDeviceSettings,
  onNewTable,
}: {
  store: TableStore;
  entry: NonNullable<ReturnType<typeof getGame>>;
  deviceSettings: ReturnType<typeof useDeviceSettings>[0];
  setDeviceSettings: ReturnType<typeof useDeviceSettings>[1];
  onNewTable: () => void;
}) {
  useStore(store);
  const rules = store.getRules();

  return (
    <main class="solo">
      <div class="solo__toolbar">
        <a href="/">← Home</a>
        <span>
          {entry.name} · {store.code}
        </span>
      </div>
      <div class="solo__panes">
        <section class="solo__dealer" aria-label="Dealer">
          <DealerShell
            store={store}
            module={entry.module!}
            rules={rules}
            deviceSettings={deviceSettings}
            onDeviceSettingsChange={setDeviceSettings}
            onNewTable={onNewTable}
          />
        </section>
        <section class="solo__display" aria-label="Display">
          <DisplayShell
            store={store}
            module={entry.module!}
            rules={rules}
            deviceSettings={deviceSettings}
          />
        </section>
      </div>
    </main>
  );
}
