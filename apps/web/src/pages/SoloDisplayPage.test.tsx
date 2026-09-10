/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationProvider, Router } from "preact-iso";
import { SoloDisplayPage } from "./SoloDisplayPage.js";

vi.mock("../hooks/use-device-settings.js", () => ({
  useDeviceSettings: () => [{}, vi.fn()],
}));

vi.mock("../shells/DisplayShell.js", () => ({
  DisplayShell: () => <div data-testid="display-shell">Display Shell</div>,
}));

vi.mock("../table/solo-channel.js", () => ({
  isSoloBroadcastChannelAvailable: vi.fn(() => false),
  createSoloDisplayStore: vi.fn(),
  waitForSoloSnapshot: vi.fn(),
}));

function renderPage(path: string) {
  window.history.replaceState({}, "", path);
  return render(
    <LocationProvider>
      <Router>
        <SoloDisplayPage path="/solo/:game/display" />
      </Router>
    </LocationProvider>,
  );
}

describe("SoloDisplayPage", () => {
  beforeEach(() => {
    vi.stubGlobal("BroadcastChannel", undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows layperson error when BroadcastChannel is unavailable", async () => {
    renderPage("/solo/roulette/display?code=ABCD23");

    await waitFor(() => {
      expect(screen.getByTestId("solo-display-error")).toBeTruthy();
    });

    expect(screen.getByTestId("solo-display-error").textContent).toMatch(
      /Display mirror link from the dealer tab/,
    );
    expect(screen.getByTestId("solo-display-error").textContent).not.toMatch(/BroadcastChannel/i);
  });
});
