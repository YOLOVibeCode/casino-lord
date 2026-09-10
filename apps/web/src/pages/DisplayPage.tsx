import { useEffect, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { normalizeTableCode } from "@casino-lord/core";
import { useDeviceSettings } from "../hooks/use-device-settings.js";
import { DisplayShell } from "../shells/DisplayShell.js";
import { getTableMeta } from "../sync/api.js";
import { isSyncConfigured, getSyncBaseUrl } from "../sync/config.js";
import { isDefinitiveSyncError } from "../sync/error-copy.js";
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
  const [reconnecting, setReconnecting] = useState(false);
  const [connectAttempt, setConnectAttempt] = useState(0);
  const [deviceSettings, setDeviceSettings] = useDeviceSettings();

  useEffect(() => {
    if (!isSyncConfigured()) {
      setError("NOT_CONFIGURED");
      setLoading(false);
      return;
    }

    let destroyed = false;
    let syncStore: SyncStore | null = null;
    setReconnecting(false);
    setError(null);
    setStore(null);
    setLoading(true);

    void (async () => {
      try {
        const meta = await getTableMeta(getSyncBaseUrl(), code);
        if (destroyed) return;
        if (!meta.exists) {
          setError("NOT_FOUND");
          setLoading(false);
          return;
        }
        const entry = getGame(meta.game ?? "baccarat");
        if (!entry?.module) {
          setError("UNSUPPORTED_GAME");
          setLoading(false);
          return;
        }

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

        await waitForSyncReady(syncStore);
        if (!destroyed) {
          setStore(syncStore);
          setLoading(false);
        }
      } catch (err) {
        if (destroyed) return;
        const message = err instanceof Error ? err.message : "Could not load table";
        if (
          message === "sync join timeout" &&
          syncStore &&
          syncStore.events.length > 0
        ) {
          setStore(syncStore);
          setReconnecting(true);
          setLoading(false);
          return;
        }
        setError(message);
        setLoading(false);
      }
    })();

    return () => {
      destroyed = true;
      syncStore?.destroy();
    };
  }, [code, connectAttempt]);

  useEffect(() => {
    if (!loading && !reconnecting && error && isDefinitiveSyncError(error)) {
      route(`/sync-error?reason=${encodeURIComponent(error)}`);
    }
  }, [error, loading, reconnecting, route]);

  const [, setTick] = useState(0);
  useEffect(() => store?.subscribe(() => setTick((n) => n + 1)), [store]);

  const handleRetry = (): void => {
    store?.destroy();
    setStore(null);
    setReconnecting(false);
    setConnectAttempt((n) => n + 1);
  };

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

  if (!store) {
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
      {reconnecting && (
        <div class="display-page__reconnect" data-testid="reconnect-banner">
          Reconnecting…
          <button type="button" onClick={handleRetry}>
            Retry
          </button>
        </div>
      )}
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
