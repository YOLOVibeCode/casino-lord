/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QrBadge } from "./QrBadge.js";

vi.mock("./qr.js", () => ({
  qrSvg: vi.fn(async () => "<svg data-testid='qr-svg'></svg>"),
}));

describe("QrBadge", () => {
  afterEach(() => cleanup());

  it("renders accessible QR with table code at scannable size", async () => {
    render(<QrBadge url="https://example.com/play/ABCD12" tableCode="ABCD12" />);

    await waitFor(() => {
      expect(screen.getByTestId("display-qr-badge")).toBeTruthy();
    });

    const image = screen.getByRole("img", { name: "Join QR for table ABCD12" });
    expect(image.className).toContain("qr-badge__image");
    expect(screen.getByText("ABCD12")).toBeTruthy();
  });

  it("renders custom caption when provided", async () => {
    render(
      <QrBadge
        url="https://example.com/play/ABCD12"
        tableCode="ABCD12"
        caption="Scan to join · ABCD12"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Scan to join · ABCD12")).toBeTruthy();
    });
  });
});
