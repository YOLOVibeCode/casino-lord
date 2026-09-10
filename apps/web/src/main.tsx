import { render } from "preact";
import { App } from "./app.js";
import { setServiceWorkerRegistration } from "./pwa/sw-registration.js";

render(<App />, document.getElementById("app")!);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register(`/sw.js?v=${__BUILD_HASH__}`)
    .then((registration) => {
      setServiceWorkerRegistration(registration);
    })
    .catch(() => {});
}
