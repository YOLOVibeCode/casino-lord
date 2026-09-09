/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocationProvider, Router } from "preact-iso";

vi.mock("../table/solo-table.js", () => ({
  resolveSoloTableStore: vi.fn(async () => ({
    code: "SOLO01",
    game: "craps",
    events: [],
    getComposed: () => ({
      platform: {
        participation: { playerMode: "off", virtualOutcomes: false },
        settings: { rules: {} },
      },
      module: {
        results: [],
        liveInput: { a: null, b: null },
        phase: "come_out",
        point: null,
        shooter: {
          rolls: [],
          rollCount: 0,
          pointsMade: 0,
          distinctPointsMade: [],
          ats: { small: [], tall: [] },
          hardWays: { "4": 0, "6": 0, "8": 0, "10": 0 },
          rollsSincePoint: 0,
        },
        table: {
          rolls: 0,
          shooters: 0,
          longestHand: 0,
          mostPointsMade: 0,
          distribution: Array.from({ length: 13 }, () => 0),
          sevensRolled: 0,
        },
        lastRoll: null,
        currentShooterId: null,
        shooterOrder: [],
        seriesLabel: null,
      },
    }),
    getRules: () => ({
      maxOdds: "3-4-5x",
      field12: 3,
      field2: 2,
      buyVigOnWin: false,
      fire4: 24,
      fire5: 249,
      fire6: 999,
      trackFire: true,
      trackAllTallSmall: false,
      hotShooterThreshold: 20,
      distributionWindow: "shooter",
      autoNewShooterOnSevenOut: true,
      showLiveDice: true,
      barNumber: 12,
      putBets: false,
      placeWorkingOnComeOut: false,
      shooterMustBetLine: true,
      shooterIdleSec: 45,
      hornHigh: true,
    }),
    getTableMeta: () => ({
      code: "SOLO01",
      game: "craps",
      seriesNumber: 1,
      resultIndex: 0,
      participation: { playerMode: "off", virtualOutcomes: false },
      playerCount: 0,
    }),
    emit: vi.fn(),
    record: vi.fn(),
    undoLastResult: vi.fn(),
    editResult: vi.fn(),
    deleteResult: vi.fn(),
    startNewSeries: vi.fn(),
    endSession: vi.fn(),
    importResults: vi.fn(),
    subscribe: () => () => {},
  })),
  createNewSoloTable: vi.fn(),
}));

import { SoloPage } from "./SoloPage.js";

function renderSolo() {
  window.history.replaceState({}, "", "/solo/craps");
  return render(
    <LocationProvider>
      <Router>
        <SoloPage path="/solo/:game" />
      </Router>
    </LocationProvider>,
  );
}

describe("SoloPage craps", () => {
  afterEach(() => cleanup());

  it("renders dealer and display shells at /solo/craps", async () => {
    renderSolo();
    await vi.waitFor(() => {
      expect(screen.getByTestId("dealer-shell")).toBeTruthy();
      expect(screen.getByTestId("display-shell")).toBeTruthy();
    });
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });
});
