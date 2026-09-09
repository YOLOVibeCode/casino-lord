import { useEffect, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { normalizeTableCode } from "@casino-lord/core";
import { useDeviceSettings } from "../hooks/use-device-settings.js";
import { DealerShell } from "../shells/DealerShell.js";
import { isSyncConfigured, getSyncBaseUrl } from "../sync/config.js";
import { loadDealerToken, saveDealerToken } from "../sync/dealer-token.js";
import { getGame } from "../table/games.js";
import { createSyncedTableStore, waitForSyncReady } from "../table/synced-store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import "./dealer-page.css";

export function DealerPage(_props: { path?: string }) {
  const { route } = useLocation();
  const { params, query } = useRoute();
  const rawCode = params.code ?? "";
  const code = normalizeTableCode(rawCode);
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

    const queryToken = query.t;
    const storedToken = loadDealerToken(code);
    const token = queryToken || storedToken || undefined;
    if (queryToken) saveDealerToken(code, queryToken);

    if (!token) {
      setError("BAD_TOKEN");
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
      role: "dealer",
      token,
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
  }, [code, query.t]);

  useEffect(() => {
    if (!loading && (error || !store)) {
      const reason = error === "NOT_CONFIGURED" ? "NOT_FOUND" : (error ?? "NOT_FOUND");
      route(`/sync-error?reason=${encodeURIComponent(reason)}`);
    }
  }, [error, loading, store, route]);

  // Re-render on demotion/connection changes so the banner tracks the store.
  const [, setTick] = useState(0);
  useEffect(() => store?.subscribe(() => setTick((n) => n + 1)), [store]);

  if (!isSyncConfigured()) {
    return (
      <main class="dealer-page dealer-page--error">
        <p>Sync server not configured</p>
        <a href="/">Home</a>
      </main>
    );
  }

  if (loading) {
    return (
      <main class="dealer-page">
        <p>Connecting…</p>
      </main>
    );
  }

  if (error || !store) {
    return (
      <main class="dealer-page">
        <p>Unable to join table…</p>
      </main>
    );
  }

  const entry = getGame(store.game);
  if (!entry?.module) return null;

  return (
    <main class="dealer-page">
      {store.isReadOnly() && (
        <div class="dealer-page__demoted" data-testid="demoted-banner">
          Another dealer took over.
          <button type="button" onClick={() => store.takeover()}>
            Take back
          </button>
        </div>
      )}
      <DealerShell
        store={store}
        module={entry.module}
        rules={store.getRules()}
        deviceSettings={deviceSettings}
        onDeviceSettingsChange={setDeviceSettings}
      />
    </main>
  );
}
