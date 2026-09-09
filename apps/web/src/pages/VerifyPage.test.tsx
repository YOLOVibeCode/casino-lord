/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import { LocationProvider, Router } from "preact-iso";
import { describe, expect, it } from "vitest";
import { VerifyPage } from "./VerifyPage.js";

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
  it("renders and verifies pasted export with seed replay", async () => {
    renderVerifyPage();

    expect(screen.getByTestId("verify-page")).toBeTruthy();

    const exportText = [
      "#casino-lord v3 game=roulette table=TEST01 series=1 started=2026-01-01T00:00:00.000Z source=virtual rules=eyJ3aGVlbCI6ImRyYWdvbiJ9",
      "17",
    ].join("\n");

    fireEvent.input(screen.getByTestId("verify-export"), { target: { value: exportText } });

    const textboxes = screen.getAllByRole("textbox");
    fireEvent.input(textboxes[1]!, { target: { value: "series-test-1" } });
    fireEvent.input(textboxes[2]!, { target: { value: "a".repeat(64) } });
    fireEvent.input(textboxes[3]!, {
      target: {
        value: "010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
      },
    });

    fireEvent.click(screen.getByTestId("verify-run"));

    await waitFor(() => {
      expect(screen.getByTestId("verify-results")).toBeTruthy();
    });
  });
});
