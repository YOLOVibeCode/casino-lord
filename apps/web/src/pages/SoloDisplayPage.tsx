import { isValidTableCode, normalizeTableCode } from "@casino-lord/core";
import { useEffect, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { useDeviceSettings } from "../hooks/use-device-settings.js";
import { DisplayShell } from "../shells/DisplayShell.js";
import { getGame } from "../table/games.js";
import {
  createSoloDisplayStore,
  isSoloBroadcastChannelAvailable,
  waitForSoloSnapshot,
} from "../table/solo-channel.js";
import type { TableStore } from "../table/store.js";
import "./display-page.css";

type SoloDisplayStore = TableStore & { destroy(): void };

export function SoloDisplayPage(_props: { path?: string }) {
  const { route } = useLocation();
  const { params, query } = useRoute();
  const gameId = params.game ?? "";
  const rawCode = query.code ?? "";
  const code = normalizeTableCode(rawCode);
  const entry = getGame(gameId);

  const [store, setStore] = useState<SoloDisplayStore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceSettings, setDeviceSettings] = useDeviceSettings();

  useEffect(() => {
    if (!isSoloBroadcastChannelAvailable()) {
      setError("Local display requires BroadcastChannel support");
      setLoading(false);
      return;
    }

    if (!entry?.enabled || !entry.module) {
      setError("Unknown or disabled game");
      setLoading(false);
      return;
    }

    if (!isValidTableCode(code)) {
      setError("Invalid table code");
      setLoading(false);
      return;
    }

    let destroyed = false;
    const displayStore = createSoloDisplayStore({
      code,
      game: entry.id,
      module: entry.module,
      rules: entry.module.defaultRules,
    }) as SoloDisplayStore;

    void waitForSoloSnapshot(displayStore)
      .then(() => {
        if (!destroyed) {
          setStore(displayStore);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!destroyed) {
          displayStore.destroy();
          setError("Could not connect to dealer tab");
          setLoading(false);
        }
      });

    return () => {
      destroyed = true;
      displayStore.destroy();
    };
  }, [code, entry]);

  if (error) {
    return (
      <main class="display-page display-page--error" data-testid="solo-display-page">
        <p>{error}</p>
        <button type="button" onClick={() => route("/")}>
          Home
        </button>
      </main>
    );
  }

  if (loading || !store || !entry?.module) {
    return (
      <main class="display-page" data-testid="solo-display-page">
        <p>Connecting…</p>
      </main>
    );
  }

  return (
    <main class="display-page" data-testid="solo-display-page">
      <DisplayShell
        store={store}
        module={entry.module}
        rules={store.getRules()}
        deviceSettings={deviceSettings}
      />
    </main>
  );
}
