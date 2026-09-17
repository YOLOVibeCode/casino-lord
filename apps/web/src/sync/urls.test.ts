/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./config.js", () => ({
  getSyncBaseUrl: () => "http://sync-only.internal:3000",
}));

import { appBaseUrl, tableUrl } from "./urls.js";

function setOrigin(origin: string): void {
  window.history.replaceState({}, "", "/");
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, origin },
  });
}

describe("tableUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds links from the page origin, not the sync URL", () => {
    setOrigin("http://192.168.1.50:3000");

    expect(appBaseUrl()).toBe("http://192.168.1.50:3000");
    expect(tableUrl("/play/K7X2PQ")).toBe("http://192.168.1.50:3000/play/K7X2PQ");
  });

  it("keeps a QR scannable when the sync URL is a loopback address", () => {
    // `pnpm --filter web dev` on :5173 against a sync server on 127.0.0.1:3000.
    // A QR built from the sync URL resolves to the *phone* when scanned.
    setOrigin("http://192.168.1.50:5173");

    expect(tableUrl("/play/K7X2PQ")).not.toContain("127.0.0.1");
    expect(tableUrl("/play/K7X2PQ")).toBe("http://192.168.1.50:5173/play/K7X2PQ");
  });

  it("normalises paths and trailing slashes", () => {
    setOrigin("https://casinolord.example/");

    expect(tableUrl("display/K7X2PQ")).toBe("https://casinolord.example/display/K7X2PQ");
    expect(tableUrl("/dealer/K7X2PQ?t=abc")).toBe("https://casinolord.example/dealer/K7X2PQ?t=abc");
  });

  it("falls back to the sync base URL when there is no window", () => {
    const original = globalThis.window;
    // @ts-expect-error deliberately simulating a non-browser context
    delete globalThis.window;
    try {
      expect(appBaseUrl()).toBe("http://sync-only.internal:3000");
    } finally {
      globalThis.window = original;
    }
  });
});
