import { useEffect, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { normalizeTableCode } from "@casino-lord/core";
import { useDeviceSettings } from "../hooks/use-device-settings.js";
import { DisplayShell } from "../shells/DisplayShell.js";
import { isSyncConfigured, getSyncBaseUrl } from "../sync/config.js";
import { tableUrl } from "../sync/urls.js";
import { getGame } from "../table/games.js";
import { createSyncedTableStore, waitForSyncReady } from "../table/synced-store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import "./display-page.css";

export function DisplayPage(_props: { path?: string }) {
  const { route } = useLocation();
  const { params } = useRoute();
  const code = normalizeTableCode(params.code ?? "");
  const [store, setStore] = useState<SyncStore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceSettings, setDeviceSettings] = useDeviceSettings();

  useEffect(() => {
    if (!isSyncConfigured()) {
      setError("NOT_CONFIGURED");
      setLoading(false);
      return;
    }

    const entry = getGame("baccarat");
    if (!entry?.module) {
      setError("UNSUPPORTED_GAME");
      setLoading(false);
      return;
    }

    let destroyed = false;
    let syncStore: SyncStore | null = null;

    syncStore = createSyncedTableStore({
      code,
      role: "display",
      syncUrl: getSyncBaseUrl(),
      module: entry.module,
      rules: entry.module.defaultRules,
      onJoinError: (errCode) => {
        if (!destroyed) {
          setError(errCode);
          setLoading(false);
        }
      },
    });

    void waitForSyncReady(syncStore)
      .then(() => {
        if (!destroyed) {
          setStore(syncStore);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!destroyed) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      destroyed = true;
      syncStore?.destroy();
    };
  }, [code]);

  useEffect(() => {
    if (!loading && (error || !store)) {
      route(
        `/sync-error?reason=${encodeURIComponent(error ?? "NOT_FOUND")}&code=${encodeURIComponent(code)}&role=display`,
      );
    }
  }, [error, loading, store, route]);

  // Re-render on presence/connection changes so the waiting banner tracks the store.
  const [, setTick] = useState(0);
  useEffect(() => store?.subscribe(() => setTick((n) => n + 1)), [store]);

  if (!isSyncConfigured()) {
    return (
      <main class="display-page display-page--error">
        <p>Sync server not configured</p>
        <a href="/">Home</a>
      </main>
    );
  }

  if (loading) {
    return (
      <main class="display-page">
        <p>Connecting…</p>
      </main>
    );
  }

  if (error || !store) {
    return (
      <main class="display-page">
        <p>Unable to join table…</p>
      </main>
    );
  }

  const entry = getGame(store.game);
  if (!entry?.module) return null;

  const waitingForDealer = store.getPresence().dealers === 0;
  const displayQrUrl = tableUrl(`/display/${code}`);

  return (
    <main class="display-page">
      {waitingForDealer && (
        <div class="display-page__waiting" data-testid="waiting-for-dealer">
          Waiting for dealer
        </div>
      )}
      <DisplayShell
        store={store}
        module={entry.module}
        rules={store.getRules()}
        deviceSettings={deviceSettings}
        displayQrUrl={displayQrUrl}
        syncBaseUrl={getSyncBaseUrl()}
      />
    </main>
  );
}
