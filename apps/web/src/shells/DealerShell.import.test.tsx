/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../sync/urls.js", () => ({
  tableUrl: (path: string) => `http://127.0.0.1:3000${path}`,
}));
import { base64UrlEncodeJson } from "@casino-lord/core";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import { UiProviders } from "../ui/test-providers.js";
import { DealerShell } from "./DealerShell.js";

const baccarat = asUntypedModule(baccaratModule);

function sampleExportWithPlayersAndBets(): string {
  const header = [
    "#casino-lord v3 game=baccarat table=TEST01 series=1 started=2026-01-01T00:00:00.000Z source=physical",
    `rules=${base64UrlEncodeJson(DEFAULT_BACCARAT_RULES)}`,
  ].join(" ");
  return [
    header,
    "B P T Bb",
    "#players",
    "p1 Ana issued=500 net=0 final=500",
    "#bets",
    "r1 p1 banker 100 win 100",
  ].join("\n");
}

function openMenuImport() {
  const menuBtn = screen.getByTestId("dealer-shell").querySelector(".dealer-shell__menu button");
  fireEvent.click(menuBtn!);
  fireEvent.click(screen.getByTestId("menu-import"));
}

describe("DealerShell import sheet", () => {
  afterEach(() => cleanup());

  it("shows player and bet preview before importing", async () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    render(
      <UiProviders>
        <DealerShell
          store={store}
          module={baccarat}
          rules={DEFAULT_BACCARAT_RULES}
          deviceSettings={DEFAULT_DEVICE_SETTINGS}
          onDeviceSettingsChange={() => {}}
        />
      </UiProviders>,
    );

    openMenuImport();
    expect(screen.getByTestId("prompt-sheet")).toBeTruthy();

    fireEvent.input(screen.getByTestId("prompt-sheet-input"), {
      target: { value: sampleExportWithPlayersAndBets() },
    });

    await waitFor(() => {
      expect(screen.getByTestId("prompt-sheet-preview").textContent).toBe(
        "1 players, 1 bets — not imported",
      );
    });
  });

  it("shows toast on invalid import instead of alert", async () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:01.000Z",
      id: () => "s1",
    });

    render(
      <UiProviders>
        <DealerShell
          store={store}
          module={baccarat}
          rules={DEFAULT_BACCARAT_RULES}
          deviceSettings={DEFAULT_DEVICE_SETTINGS}
          onDeviceSettingsChange={() => {}}
        />
      </UiProviders>,
    );

    openMenuImport();
    fireEvent.input(screen.getByTestId("prompt-sheet-input"), {
      target: { value: "NOT_VALID!!!" },
    });
    fireEvent.click(screen.getByTestId("prompt-sheet-confirm"));

    await waitFor(() => {
      expect(screen.getByTestId("dealer-toast")).toBeTruthy();
    });
  });
});
