import { getSyncBaseUrl } from "./config.js";

/**
 * Base origin for links a human opens: QR targets, copy-to-clipboard URLs,
 * "open here" anchors.
 *
 * This is deliberately NOT the sync base URL. The sync URL is where the app
 * talks to the API; it can be a host only this device can reach (a `localhost`
 * dev server, a private API hostname, a split deploy). A QR built from it
 * scans to a dead address on a guest's phone. The page origin, by definition,
 * is an address that reached this device — so it is the one that also reaches
 * the phone standing next to it.
 *
 * Falls back to the sync base URL only when there is no document (SSR/tests).
 */
export function appBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return getSyncBaseUrl();
}

export function tableUrl(path: string): string {
  const base = appBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
