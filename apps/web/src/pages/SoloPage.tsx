import { useCallback, useEffect, useState } from "preact/hooks";
import { useRoute } from "preact-iso";
import type { Participation } from "@casino-lord/core";
import { useDeviceSettings } from "../hooks/use-device-settings.js";
import { DealerShell } from "../shells/DealerShell.js";
import { DisplayShell } from "../shells/DisplayShell.js";
import { useStore } from "../hooks/use-store.js";
import { getGame } from "../table/games.js";
import { createNewSoloTable, resolveSoloTableStore } from "../table/solo-table.js";
import type { TableStore } from "../table/store.js";
import "./solo.css";

function soloParticipation(outcomeSource: "physical" | "virtual"): Participation {
  return { playerMode: "off", bank: "none", outcomeSource };
}

export function SoloPage(_props: { path?: string }) {
  const { params } = useRoute();
  const gameId = params.game ?? "";
  const entry = getGame(gameId);
  const [store, setStore] = useState<TableStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [outcomeSource, setOutcomeSource] = useState<"physical" | "virtual">("physical");
  const [deviceSettings, setDeviceSettings] = useDeviceSettings();
  const supportsVirtual = Boolean(entry?.module?.virtual);

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
        setOutcomeSource(resolved.getComposed().platform.participation.outcomeSource);
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
      participation: soloParticipation(outcomeSource),
    });
    setStore(next);
  }, [entry, outcomeSource]);

  const handleOutcomeSourceChange = useCallback(
    async (next: "physical" | "virtual") => {
      if (!entry?.enabled || !entry.module || next === outcomeSource) return;
      if (next === "virtual" && !supportsVirtual) return;
      setOutcomeSource(next);
      const nextStore = await createNewSoloTable({
        game: entry.id,
        module: entry.module,
        rules: entry.module.defaultRules,
        participation: soloParticipation(next),
      });
      setStore(nextStore);
    },
    [entry, outcomeSource, supportsVirtual],
  );

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
      outcomeSource={outcomeSource}
      supportsVirtual={supportsVirtual}
      onOutcomeSourceChange={(next) => void handleOutcomeSourceChange(next)}
      deviceSettings={deviceSettings}
      setDeviceSettings={setDeviceSettings}
      onNewTable={() => void handleNewTable()}
    />
  );
}

function SoloPanes({
  store,
  entry,
  outcomeSource,
  supportsVirtual,
  onOutcomeSourceChange,
  deviceSettings,
  setDeviceSettings,
  onNewTable,
}: {
  store: TableStore;
  entry: NonNullable<ReturnType<typeof getGame>>;
  outcomeSource: "physical" | "virtual";
  supportsVirtual: boolean;
  onOutcomeSourceChange: (next: "physical" | "virtual") => void;
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
        <div class="solo__mode" role="group" aria-label="Outcome source">
          <button
            type="button"
            class={`solo__mode-btn${outcomeSource === "physical" ? " solo__mode-btn--active" : ""}`}
            aria-pressed={outcomeSource === "physical"}
            onClick={() => onOutcomeSourceChange("physical")}
          >
            Physical
          </button>
          <button
            type="button"
            class={`solo__mode-btn${outcomeSource === "virtual" ? " solo__mode-btn--active" : ""}`}
            aria-pressed={outcomeSource === "virtual"}
            disabled={!supportsVirtual}
            title={supportsVirtual ? undefined : "Virtual not available for this game"}
            onClick={() => onOutcomeSourceChange("virtual")}
          >
            Virtual
          </button>
        </div>
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
