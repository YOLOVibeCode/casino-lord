/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/preact";
import { LocationProvider, Router } from "preact-iso";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VerifyPage } from "./VerifyPage.js";
import { DEFAULT_ROULETTE_RULES } from "@casino-lord/game-roulette";
import { base64UrlEncodeJson } from "@casino-lord/core";
import * as syncConfig from "../sync/config.js";

function renderVerifyPage() {
  window.history.replaceState({}, "", "/verify");
  return render(
    <LocationProvider>
      <Router>
        <VerifyPage path="/verify" />
      </Router>
    </LocationProvider>,
  );
}

describe("VerifyPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("verifies pasted export using header commit, seed, and seriesId", async () => {
    renderVerifyPage();

    const header = [
      "#casino-lord v3 game=roulette table=TEST01 series=1 started=2026-01-01T00:00:00.000Z source=virtual",
      "seriesId=series-test-1",
      `commit=${"a".repeat(64)}`,
      "seed=010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
      `rules=${base64UrlEncodeJson(DEFAULT_ROULETTE_RULES)}`,
    ].join(" ");
    const exportText = [header, "17", "#players", "#bets"].join("\n");

    fireEvent.input(screen.getByTestId("verify-export"), { target: { value: exportText } });
    fireEvent.click(screen.getByTestId("verify-run"));

    await waitFor(() => {
      expect(screen.getByTestId("verify-results")).toBeTruthy();
    });
  });

  it("fetch mode loads series picker from fairness list", async () => {
    vi.spyOn(syncConfig, "resolveSyncUrl").mockReturnValue("http://127.0.0.1:3000");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("fairness?list=1")) {
          return {
            ok: true,
            json: async () => ({
              series: [
                {
                  number: 1,
                  seriesId: "series-test-1",
                  commit: "a".repeat(64),
                  seedRevealed: true,
                },
              ],
            }),
          };
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    renderVerifyPage();
    fireEvent.click(screen.getAllByRole("radio")[1]!);
    fireEvent.input(screen.getByTestId("verify-code"), { target: { value: "TEST01" } });

    await waitFor(() => {
      const select = screen.getByTestId("verify-series-select") as HTMLSelectElement;
      expect(select.options.length).toBe(1);
      expect(select.options[0]!.textContent).toContain("revealed");
    });
  });
});
