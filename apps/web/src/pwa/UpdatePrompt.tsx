import { createContext } from "preact";
import { useCallback, useContext, useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { useToast } from "../ui/Toast.js";
import { getServiceWorkerRegistration, whenServiceWorkerReady } from "./sw-registration.js";
import "./update-prompt.css";

const IDLE_RELOAD_MS = 30_000;

interface UpdatePromptContextValue {
  unattended: boolean;
  isTableIdle: boolean;
}

const UpdatePromptContext = createContext<UpdatePromptContextValue>({
  unattended: false,
  isTableIdle: true,
});

export function UpdatePromptProvider({
  children,
  unattended = false,
  isTableIdle = true,
}: {
  children: ComponentChildren;
  unattended?: boolean;
  isTableIdle?: boolean;
}) {
  return (
    <UpdatePromptContext.Provider value={{ unattended, isTableIdle }}>
      {children}
    </UpdatePromptContext.Provider>
  );
}

function postSkipWaiting(worker: ServiceWorker): void {
  worker.postMessage({ type: "SKIP_WAITING" });
}

export function UpdatePrompt() {
  const toast = useToast();
  const { unattended, isTableIdle } = useContext(UpdatePromptContext);
  const [updateReady, setUpdateReady] = useState(false);
  const toastShown = useRef(false);
  const pendingReload = useRef(false);
  const autoApplied = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unattendedRef = useRef(unattended);

  useEffect(() => {
    unattendedRef.current = unattended;
  }, [unattended]);

  const reload = useCallback(() => {
    pendingReload.current = true;
    const registration = getServiceWorkerRegistration();
    if (registration?.waiting) {
      postSkipWaiting(registration.waiting);
      return;
    }
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const onControllerChange = (): void => {
      if (!pendingReload.current) return;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const notifyUpdate = (): void => {
      if (toastShown.current) return;
      toastShown.current = true;
      if (!unattendedRef.current) {
        toast.info("New version available — Reload", {
          testId: "pwa-update-toast",
          durationMs: 20_000,
        });
      }
      setUpdateReady(true);
    };

    const trackInstalling = (worker: ServiceWorker): void => {
      worker.addEventListener("statechange", () => {
        if (worker.state !== "installed") return;

        if (!navigator.serviceWorker.controller) {
          postSkipWaiting(worker);
          return;
        }

        notifyUpdate();
      });
    };

    void whenServiceWorkerReady().then((registration) => {
      if (cancelled || !registration) return;

      if (registration.waiting) {
        notifyUpdate();
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (installing) trackInstalling(installing);
      });

      if (registration.installing) {
        trackInstalling(registration.installing);
      }
    });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [toast]);

  useEffect(() => {
    if (!updateReady || !unattended || autoApplied.current) return;

    if (isTableIdle) {
      if (idleTimer.current) return;
      idleTimer.current = setTimeout(() => {
        idleTimer.current = null;
        if (autoApplied.current || !unattendedRef.current) return;
        autoApplied.current = true;
        reload();
      }, IDLE_RELOAD_MS);
      return;
    }

    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  }, [updateReady, unattended, isTableIdle, reload]);

  useEffect(() => {
    return () => {
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
    };
  }, []);

  if (!updateReady || unattended) return null;

  return (
    <div class="pwa-update-prompt">
      <button
        type="button"
        class="pwa-update-prompt__reload"
        data-testid="pwa-reload-btn"
        onClick={reload}
      >
        Reload
      </button>
    </div>
  );
}
