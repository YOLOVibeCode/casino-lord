/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { LocationProvider, Router } from "preact-iso";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage.js";

const routeMock = vi.fn();

vi.mock("preact-iso", async () => {
  const actual = await vi.importActual<typeof import("preact-iso")>("preact-iso");
  return {
    ...actual,
    useLocation: () => ({ route: routeMock }),
  };
});

vi.mock("../sync/config.js", () => ({
  isSyncConfigured: () => true,
  getSyncBaseUrl: () => "http://localhost:3000",
}));

vi.mock("../sync/api.js", () => ({
  createTable: vi.fn(async () => ({ code: "K7X2PQ", dealerToken: "tok" })),
  getTableMeta: vi.fn(),
  fetchServerFeatures: vi.fn(async () => ({ enableVirtual: true })),
}));

import { createTable } from "../sync/api.js";

function renderLanding() {
  window.history.replaceState({}, "", "/");
  return render(
    <LocationProvider>
      <Router>
        <LandingPage path="/" />
      </Router>
    </LocationProvider>,
  );
}

describe("LandingPage create sheet", () => {
  beforeEach(() => {
    routeMock.mockReset();
    localStorage.clear();
  });

  afterEach(() => cleanup());

  it("creates table with player mode and house bank", async () => {
    renderLanding();

    fireEvent.click(screen.getByText("Create Table"));
    fireEvent.click(screen.getByLabelText(/With players/i));
    expect(screen.getByTestId("house-bank-checkbox")).toBeTruthy();
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(createTable).toHaveBeenCalledWith(
        "http://localhost:3000",
        expect.objectContaining({
          participation: { playerMode: "on", bank: "house", outcomeSource: "physical" },
        }),
      );
    });
  });

  it("shows action explainers, how-it-works, and verify link", () => {
    renderLanding();

    expect(screen.getAllByText("Solo — one device, you record results").length).toBeGreaterThan(0);
    expect(screen.getByText(/Create table — a code your TV/)).toBeTruthy();
    expect(screen.getByText("Join — enter a code someone gave you")).toBeTruthy();
    expect(screen.getByTestId("how-it-works")).toBeTruthy();
    expect(screen.getByTestId("landing-verify-link").getAttribute("href")).toBe("/verify");
  });

  it("shows create sheet helper text", () => {
    renderLanding();
    fireEvent.click(screen.getByText("Create Table"));

    expect(screen.getByTestId("participation-help")).toBeTruthy();
    expect(screen.getByTestId("outcome-help")).toBeTruthy();
    expect(screen.getByTestId("landing-sheet").textContent).toMatch(
      /Play chips only — no real money, ever\./,
    );
  });

  it("shows house bank helper when with players is selected", () => {
    renderLanding();
    fireEvent.click(screen.getByText("Create Table"));
    fireEvent.click(screen.getByLabelText(/With players/i));

    expect(screen.getByTestId("house-bank-help")).toBeTruthy();
    fireEvent.click(screen.getByTestId("house-bank-checkbox"));
    expect(screen.getByTestId("house-bank-help").textContent).toMatch(/track chips themselves/i);
  });

  it("lists recent tables and supports forget and reopen", () => {
    localStorage.setItem(
      "casino-lord:dealer-token:ABCD23",
      JSON.stringify({ token: "saved-tok", game: "baccarat", lastOpenedAt: 1_700_000_000_000 }),
    );
    localStorage.setItem(
      "casino-lord:dealer-token:WXYZ99",
      JSON.stringify({ token: "other-tok", game: "craps", lastOpenedAt: 1_700_000_100_000 }),
    );

    renderLanding();

    expect(screen.getByTestId("your-tables")).toBeTruthy();
    expect(screen.getByTestId("your-table-WXYZ99")).toBeTruthy();
    expect(screen.getByTestId("your-table-ABCD23")).toBeTruthy();

    fireEvent.click(screen.getByTestId("reopen-WXYZ99"));
    expect(routeMock).toHaveBeenCalledWith("/dealer/WXYZ99?t=other-tok");

    fireEvent.click(screen.getByTestId("forget-ABCD23"));
    expect(screen.queryByTestId("your-table-ABCD23")).toBeNull();
    expect(screen.getByTestId("your-table-WXYZ99")).toBeTruthy();
  });

  it("hides your tables when localStorage is empty", () => {
    renderLanding();
    expect(screen.queryByTestId("your-tables")).toBeNull();
  });
});
