import { useMemo } from "preact/hooks";
import { useRoute } from "preact-iso";
import { loadDeviceSettings } from "../settings/device-settings.js";
import { DealerShell } from "../shells/DealerShell.js";
import { DisplayShell } from "../shells/DisplayShell.js";
import { getGame } from "../table/games.js";
import { createTableStore } from "../table/store.js";
import "./solo.css";

export function SoloPage(_props: { path?: string }) {
  const { params } = useRoute();
  const gameId = params.game ?? "";
  const entry = getGame(gameId);

  const store = useMemo(() => {
    if (!entry?.enabled || !entry.module) return null;
    return createTableStore({
      game: entry.id,
      module: entry.module,
      rules: entry.module.defaultRules,
    });
  }, [entry]);

  if (!entry) {
    return (
      <main class="solo solo--error">
        <p>Unknown game.</p>
        <a href="/">Back</a>
      </main>
    );
  }

  if (!entry.enabled || !store) {
    return (
      <main class="solo solo--error">
        <p>{entry.name} is coming soon.</p>
        <a href="/">Back</a>
      </main>
    );
  }

  const deviceSettings = loadDeviceSettings();
  const rules = entry.module!.defaultRules;

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
