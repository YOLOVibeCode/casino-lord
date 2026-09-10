import { useEffect, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { normalizeTableCode } from "@casino-lord/core";
import { useDeviceSettings } from "../hooks/use-device-settings.js";
import { DisplayShell } from "../shells/DisplayShell.js";
import { isSyncConfigured, getSyncBaseUrl } from "../sync/config.js";
import { SYNC_JOIN_TIMEOUT } from "../sync/error-copy.js";
import { getGame } from "../table/games.js";
import type { UntypedGameModule } from "../table/module-types.js";
import { UpdatePromptProvider } from "../pwa/UpdatePrompt.js";
import { createSyncedTableStore, waitForSyncReady } from "../table/synced-store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import "./display-page.css";

function isDisplayTableIdle(store: SyncStore): boolean {
  const composed = store.getComposed();
  if (composed.platform.rounds.some((round) => round.status === "open")) return false;
  if (store.getVirtualPending?.()) return false;
  const virtualStatus = store.getVirtualStatus();
  if (virtualStatus?.awaiting === "action" || virtualStatus?.awaiting === "trigger") {
    return false;
  }
  return true;
}

export function DisplayPage(_props: { path?: string }) {
  const { route } = useLocation();
  const { params } = useRoute();
  const code = normalizeTableCode(params.code ?? "");
  const [store, setStore] = useState<SyncStore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineJoin, setOfflineJoin] = useState(false);
  const [connectAttempt, setConnectAttempt] = useState(0);
  const [deviceSettings, setDeviceSettings] = useDeviceSettings();

  useEffect(() => {
    if (!isSyncConfigured()) {
      setError("NOT_CONFIGURED");
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

    setOfflineJoin(false);
    setError(null);
    setLoading(true);

    syncStore = createSyncedTableStore({
      code,
      role: "display",
      syncUrl: getSyncBaseUrl(),
      resolveModule,
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
          setOfflineJoin(false);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (destroyed) return;
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
  }, [code, connectAttempt]);

  useEffect(() => {
    if (loading || offlineJoin) return;
    if (store && !error) return;
    if (error) {
      route(
        `/sync-error?reason=${encodeURIComponent(error)}&code=${encodeURIComponent(code)}&role=display`,
      );
    }
  }, [error, loading, store, route, code, offlineJoin]);

  const [, setTick] = useState(0);
  useEffect(() => store?.subscribe(() => setTick((n) => n + 1)), [store]);

  const handleRetryConnect = (): void => {
    store?.destroy();
    setStore(null);
    setOfflineJoin(false);
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

  if (error || !store) {
    return (
      <main class="display-page">
        <p>Unable to join table…</p>
      </main>
    );
  }

  const isTableIdle = isDisplayTableIdle(store);

  return (
    <UpdatePromptProvider unattended isTableIdle={isTableIdle}>
      <main class="display-page">
        {offlineJoin && (
          <div class="display-page__waiting" data-testid="reconnect-bar">
            Reconnecting… ·{" "}
            <button type="button" onClick={handleRetryConnect}>
              Retry
            </button>
          </div>
        )}
        <DisplayShell
          store={store}
          module={store.getModule()}
          rules={store.getRules()}
          deviceSettings={deviceSettings}
          syncBaseUrl={getSyncBaseUrl()}
        />
      </main>
    </UpdatePromptProvider>
  );
}
