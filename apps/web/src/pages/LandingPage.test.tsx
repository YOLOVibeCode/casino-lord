/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { LocationProvider, Router } from "preact-iso";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage.js";

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

describe("LandingPage create sheet", () => {
  afterEach(() => cleanup());

  it("creates table with player mode and house bank", async () => {
    render(
      <LocationProvider>
        <Router>
          <LandingPage path="/" />
        </Router>
      </LocationProvider>,
    );

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
});
