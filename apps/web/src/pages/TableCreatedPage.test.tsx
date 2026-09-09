/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import { LocationProvider, Router } from "preact-iso";
import { TableCreatedPage } from "./TableCreatedPage.js";

vi.mock("../sync/config.js", () => ({
  getSyncBaseUrl: () => "http://test.local",
}));

vi.mock("../sync/qr.js", () => ({
  qrDataUrl: async (url: string) => `data:image/png;base64,${btoa(url)}`,
}));

function renderPage(path: string) {
  window.history.replaceState({}, "", path);
  return render(
    <LocationProvider>
      <Router>
        <TableCreatedPage path="/created/:code" />
      </Router>
    </LocationProvider>,
  );
}

describe("TableCreatedPage", () => {
  it("shows code, QR images, and open links", async () => {
    renderPage("/created/ABCD23?t=secret-token");

    expect(screen.getByTestId("table-code").textContent).toBe("ABCD23");

    await vi.waitFor(() => {
      expect(screen.getByTestId("display-qr")).toBeTruthy();
      expect(screen.getByTestId("dealer-qr")).toBeTruthy();
    });

    const displayLink = screen.getByTestId("open-display") as HTMLAnchorElement;
    expect(displayLink.getAttribute("href")).toBe("http://test.local/display/ABCD23");

    const dealerLink = screen.getByTestId("open-dealer") as HTMLAnchorElement;
    expect(dealerLink.getAttribute("href")).toBe("http://test.local/dealer/ABCD23?t=secret-token");
  });
});
