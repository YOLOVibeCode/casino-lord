/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocationProvider, Router } from "preact-iso";
import { blackjackModule } from "@casino-lord/game-blackjack";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import { UiProviders } from "../ui/test-providers.js";
import { SoloPage } from "./SoloPage.js";

vi.mock("../hooks/use-device-settings.js", () => ({
  useDeviceSettings: () => [DEFAULT_DEVICE_SETTINGS, vi.fn()],
}));

vi.mock("../sync/urls.js", () => ({
  tableUrl: (path: string) => `http://127.0.0.1:3000${path}`,
}));

const blackjack = asUntypedModule(blackjackModule);

vi.mock("../table/solo-table.js", () => ({
  resolveSoloTableStore: vi.fn(async () => {
    let n = 0;
    return createTableStore({
      game: "blackjack",
      module: blackjack,
      rules: blackjackModule.defaultRules,
      rng: () => 0,
      now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
      id: () => `id-${n}`,
    });
  }),
  createNewSoloTable: vi.fn(),
}));

function renderSoloPage(path: string) {
  window.history.replaceState({}, "", path);
  return render(
    <UiProviders>
      <LocationProvider>
        <Router>
          <SoloPage path="/solo/:game" />
        </Router>
      </LocationProvider>
    </UiProviders>,
  );
}

afterEach(() => cleanup());

describe("SoloPage blackjack route", () => {
  it("renders dealer and display shells for /solo/blackjack", async () => {
    renderSoloPage("/solo/blackjack");

    await waitFor(() => {
      expect(screen.getByTestId("dealer-shell")).toBeTruthy();
      expect(screen.getByTestId("display-view")).toBeTruthy();
    });

    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });
});
