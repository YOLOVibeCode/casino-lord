/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationProvider, Router } from "preact-iso";
import { TableCreatedPage } from "./TableCreatedPage.js";

vi.mock("../sync/config.js", () => ({
  getSyncBaseUrl: () => "http://test.local",
}));

vi.mock("../sync/qr.js", () => ({
  qrDataUrl: async (url: string) => `data:image/png;base64,${btoa(url)}`,
}));

const saveDealerTokenMock = vi.fn();
vi.mock("../sync/dealer-token.js", () => ({
  saveDealerToken: (...args: unknown[]) => saveDealerTokenMock(...args),
}));

const writeTextMock = vi.fn(async () => undefined);

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
  beforeEach(() => {
    saveDealerTokenMock.mockReset();
    writeTextMock.mockReset();
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });
  });

  afterEach(() => cleanup());

  it("shows code, QR images, and open links", async () => {
    renderPage("/created/ABCD23?t=secret-token");

    expect(screen.getByTestId("table-code").textContent).toBe("ABCD23");

    await waitFor(() => {
      expect(screen.getByTestId("display-qr")).toBeTruthy();
      expect(screen.getByTestId("dealer-qr")).toBeTruthy();
    });

    const displayLink = screen.getByTestId("open-display") as HTMLAnchorElement;
    expect(displayLink.getAttribute("href")).toBe("http://test.local/display/ABCD23");

    const dealerLink = screen.getByTestId("open-dealer") as HTMLAnchorElement;
    expect(dealerLink.getAttribute("href")).toBe("http://test.local/dealer/ABCD23?t=secret-token");
  });

  it("saves dealer token with game metadata", () => {
    renderPage("/created/ABCD23?t=secret-token&game=baccarat");
    expect(saveDealerTokenMock).toHaveBeenCalledWith("ABCD23", "secret-token", {
      game: "baccarat",
    });
  });

  it("shows next steps", () => {
    renderPage("/created/ABCD23?t=secret-token");
    expect(screen.getByTestId("table-created-next-steps")).toBeTruthy();
    expect(screen.getByText("Open Display on the TV")).toBeTruthy();
  });

  it("copies code and URLs with feedback", async () => {
    renderPage("/created/ABCD23?t=secret-token");

    fireEvent.click(screen.getByTestId("copy-table-code"));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("ABCD23");
      expect(screen.getByTestId("copy-table-code").textContent).toBe("Copied");
    });

    fireEvent.click(screen.getByTestId("copy-display-url"));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("http://test.local/display/ABCD23");
    });

    fireEvent.click(screen.getByTestId("copy-dealer-url"));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("http://test.local/dealer/ABCD23?t=secret-token");
    });

    fireEvent.click(screen.getByTestId("copy-play-url"));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("http://test.local/play/ABCD23");
    });
  });

  it("enlarges QR on tap and dismisses lightbox", async () => {
    renderPage("/created/ABCD23?t=secret-token");

    await waitFor(() => {
      expect(screen.getByTestId("display-qr")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("display-qr").closest("button")!);
    expect(screen.getByTestId("qr-lightbox")).toBeTruthy();

    fireEvent.click(screen.getByTestId("qr-lightbox"));
    expect(screen.queryByTestId("qr-lightbox")).toBeNull();
  });
});
