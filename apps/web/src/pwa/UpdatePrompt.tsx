import { useEffect, useRef, useState } from "preact/hooks";
import "./update-prompt.css";

export function UpdatePrompt() {
  const [visible, setVisible] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onControllerChange = (): void => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    void navigator.serviceWorker.ready.then((registration) => {
      registrationRef.current = registration;

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setVisible(true);
          }
        });
      });

      if (registration.waiting && navigator.serviceWorker.controller) {
        setVisible(true);
      }
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const reload = (): void => {
    const waiting = registrationRef.current?.waiting;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    window.location.reload();
  };

  if (!visible) return null;

  return (
    <div class="update-prompt" role="status">
      <span class="update-prompt__text">New version available</span>
      <button type="button" class="update-prompt__reload" onClick={reload}>
        Reload
      </button>
    </div>
  );
}
