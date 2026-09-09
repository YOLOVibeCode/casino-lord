/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ROULETTE_RULES, rouletteModule } from "@casino-lord/game-roulette";
import { LocationProvider, Router } from "preact-iso";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import { SoloPage } from "./SoloPage.js";

vi.mock("../shells/DealerShell.js", () => ({
  DealerShell: () => <div data-testid="dealer-shell">Dealer Shell</div>,
}));

vi.mock("../shells/DisplayShell.js", () => ({
  DisplayShell: () => <div data-testid="display-shell">Display Shell</div>,
}));

const roulette = asUntypedModule(rouletteModule);

vi.mock("../table/solo-table.js", () => ({
  resolveSoloTableStore: () =>
    Promise.resolve(
      createTableStore({
        game: "roulette",
        module: roulette,
        rules: DEFAULT_ROULETTE_RULES,
        rng: () => 0,
        now: () => "2026-01-01T00:00:00.000Z",
        id: () => "s1",
      }),
    ),
  createNewSoloTable: vi.fn(),
}));

function renderPage(path: string) {
  window.history.replaceState({}, "", path);
  return render(
    <LocationProvider>
      <Router>
        <SoloPage path="/solo/:game" />
      </Router>
    </LocationProvider>,
  );
}

describe("SoloPage roulette", () => {
  afterEach(() => cleanup());

  it("renders dealer and display shells at /solo/roulette", async () => {
    renderPage("/solo/roulette");
    await waitFor(() => {
      expect(screen.getByTestId("dealer-shell")).toBeTruthy();
      expect(screen.getByTestId("display-shell")).toBeTruthy();
    });
  });
});
