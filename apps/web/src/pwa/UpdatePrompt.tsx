import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useToast } from "../ui/Toast.js";
import { getServiceWorkerRegistration, whenServiceWorkerReady } from "./sw-registration.js";
import "./update-prompt.css";

function postSkipWaiting(worker: ServiceWorker): void {
  worker.postMessage({ type: "SKIP_WAITING" });
}

export function UpdatePrompt() {
  const toast = useToast();
  const [updateReady, setUpdateReady] = useState(false);
  const toastShown = useRef(false);

  const reload = useCallback(() => {
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
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const notifyUpdate = (): void => {
      if (toastShown.current) return;
      toastShown.current = true;
      toast.info("New version available — Reload", {
        testId: "pwa-update-toast",
        durationMs: 20_000,
      });
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

  if (!updateReady) return null;

  return (
    <div class="pwa-update-prompt">
      <button type="button" class="pwa-update-prompt__reload" data-testid="pwa-reload-btn" onClick={reload}>
        Reload
      </button>
    </div>
  );
}
