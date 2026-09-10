import { useEffect, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { normalizeTableCode } from "@casino-lord/core";
import { useDeviceSettings } from "../hooks/use-device-settings.js";
import { DealerShell } from "../shells/DealerShell.js";
import { getTableMeta } from "../sync/api.js";
import { isSyncConfigured, getSyncBaseUrl } from "../sync/config.js";
import { isDefinitiveSyncError } from "../sync/error-copy.js";
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
  const [dealerActive, setDealerActive] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [connectAttempt, setConnectAttempt] = useState(0);
  const [takeoverMode, setTakeoverMode] = useState(false);
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

    let destroyed = false;
    let syncStore: SyncStore | null = null;
    setDealerActive(false);
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
          role: "dealer",
          token,
          syncUrl: getSyncBaseUrl(),
          module: entry.module,
          rules: entry.module.defaultRules,
          takeover: takeoverMode,
          onJoinError: (errCode) => {
            if (!destroyed && errCode === "DEALER_ACTIVE") {
              syncStore?.destroy();
              syncStore = null;
              setDealerActive(true);
              setLoading(false);
              return;
            }
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
        if (message === "DEALER_ACTIVE") {
          syncStore?.destroy();
          setDealerActive(true);
          setLoading(false);
          return;
        }
        if (message === "sync join timeout" && syncStore && syncStore.events.length > 0) {
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
  }, [code, query.t, connectAttempt, takeoverMode]);

  useEffect(() => {
    if (!loading && !dealerActive && !reconnecting && error && isDefinitiveSyncError(error)) {
      route(`/sync-error?reason=${encodeURIComponent(error)}`);
    }
  }, [error, loading, store, dealerActive, reconnecting, route]);

  const [, setTick] = useState(0);
  useEffect(() => store?.subscribe(() => setTick((n) => n + 1)), [store]);

  const handleTakeover = (): void => {
    setTakeoverMode(true);
    setConnectAttempt((n) => n + 1);
  };

  const handleRetry = (): void => {
    store?.destroy();
    setStore(null);
    setReconnecting(false);
    setConnectAttempt((n) => n + 1);
  };

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

  if (dealerActive) {
    return (
      <main class="dealer-page dealer-page--error">
        <div class="dealer-page__active-card" data-testid="dealer-active-card">
          <h1>Another device is dealing this table</h1>
          <p>You can take over dealing or open this table as a display.</p>
          <div class="dealer-page__active-actions">
            <button type="button" onClick={handleTakeover}>
              Take over
            </button>
            <a href={`/display/${code}`}>Open as Display</a>
          </div>
        </div>
      </main>
    );
  }

  if (!store) {
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
      {reconnecting && (
        <div class="dealer-page__reconnect" data-testid="reconnect-banner">
          Reconnecting…
          <button type="button" onClick={handleRetry}>
            Retry
          </button>
        </div>
      )}
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
