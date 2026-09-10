import { render } from "preact";
import { App } from "./app.js";
import { UpdatePrompt } from "./pwa/UpdatePrompt.js";

render(<App />, document.getElementById("app")!);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register(`/sw.js?v=${__BUILD_HASH__}`).catch(() => {});
  render(<UpdatePrompt />, document.body);
}
