import { useEffect, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { normalizeTableCode } from "@casino-lord/core";
import { useDeviceSettings } from "../hooks/use-device-settings.js";
import { DealerShell } from "../shells/DealerShell.js";
import { isSyncConfigured, getSyncBaseUrl } from "../sync/config.js";
import { describeSyncError, SYNC_JOIN_TIMEOUT } from "../sync/error-copy.js";
import { loadDealerToken, saveDealerToken } from "../sync/dealer-token.js";
import { getGame } from "../table/games.js";
import type { UntypedGameModule } from "../table/module-types.js";
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
  const [joinBlocked, setJoinBlocked] = useState<"DEALER_ACTIVE" | null>(null);
  const [offlineJoin, setOfflineJoin] = useState(false);
  const [connectAttempt, setConnectAttempt] = useState(0);
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

    const resolveModule = (g: import("@casino-lord/core").GameId): UntypedGameModule => {
      const entry = getGame(g);
      if (!entry?.module) throw new Error("UNSUPPORTED_GAME");
      return entry.module;
    };

    let destroyed = false;
    let syncStore: SyncStore | null = null;

    setJoinBlocked(null);
    setOfflineJoin(false);
    setError(null);
    setLoading(true);

    syncStore = createSyncedTableStore({
      code,
      role: "dealer",
      token,
      syncUrl: getSyncBaseUrl(),
      resolveModule,
      onJoinError: (errCode) => {
        if (destroyed) return;
        if (errCode === "DEALER_ACTIVE") {
          setJoinBlocked("DEALER_ACTIVE");
          setStore(syncStore);
          setLoading(false);
          return;
        }
        setError(errCode);
        setLoading(false);
      },
    });

    void waitForSyncReady(syncStore)
      .then(() => {
        if (!destroyed) {
          setStore(syncStore);
          setJoinBlocked(null);
          setOfflineJoin(false);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (destroyed) return;
        if (err.message === "DEALER_ACTIVE") {
          setJoinBlocked("DEALER_ACTIVE");
          setStore(syncStore);
          setLoading(false);
          return;
        }
        if (err.message === SYNC_JOIN_TIMEOUT && syncStore && syncStore.events.length > 0) {
          setStore(syncStore);
          setOfflineJoin(true);
          setLoading(false);
          return;
        }
        setError(err.message);
        setLoading(false);
      });

    return () => {
      destroyed = true;
      syncStore?.destroy();
    };
  }, [code, query.t, connectAttempt]);

  useEffect(() => {
    if (loading || joinBlocked || offlineJoin) return;
    if (store && !error) return;
    if (error) {
      route(
        `/sync-error?reason=${encodeURIComponent(error)}&code=${encodeURIComponent(code)}&role=dealer`,
      );
    }
  }, [error, loading, store, route, code, joinBlocked, offlineJoin]);

  const [, setTick] = useState(0);
  useEffect(() => store?.subscribe(() => setTick((n) => n + 1)), [store]);

  const handleTakeover = (): void => {
    if (!store) return;
    setJoinBlocked(null);
    setLoading(true);
    store.takeover();
    void waitForSyncReady(store)
      .then(() => {
        setLoading(false);
      })
      .catch((err: Error) => {
        setLoading(false);
        if (err.message === "DEALER_ACTIVE") {
          setJoinBlocked("DEALER_ACTIVE");
          return;
        }
        setError(err.message);
      });
  };

  const handleRetryConnect = (): void => {
    store?.destroy();
    setStore(null);
    setOfflineJoin(false);
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

  if (joinBlocked === "DEALER_ACTIVE" && store) {
    const copy = describeSyncError("DEALER_ACTIVE");
    return (
      <main class="dealer-page dealer-page--error">
        <div data-testid="dealer-active-card">
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
          <div class="dealer-page__demoted">
            <span />
            <button type="button" data-testid="dealer-takeover-btn" onClick={handleTakeover}>
              Take over
            </button>
          </div>
          <div class="dealer-page__demoted">
            <span />
            <button
              type="button"
              data-testid="dealer-open-display-btn"
              onClick={() => route(`/display/${code}`)}
            >
              Open as Display
            </button>
          </div>
        </div>
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

  return (
    <main class="dealer-page">
      {offlineJoin && (
        <div class="dealer-page__demoted" data-testid="reconnect-bar">
          Reconnecting…
          <button type="button" onClick={handleRetryConnect}>
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
        module={store.getModule()}
        rules={store.getRules()}
        deviceSettings={deviceSettings}
        onDeviceSettingsChange={setDeviceSettings}
      />
    </main>
  );
}
