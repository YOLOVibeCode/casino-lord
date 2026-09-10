/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { qrDataUrl } from "./qr.js";
import { QrDialog, buildQrDialogEntries } from "./QrDialog.js";

vi.mock("./qr.js", () => ({
  qrDataUrl: vi.fn(async (url: string) => `data:image/png;base64,${url}`),
}));

describe("QrDialog", () => {
  afterEach(() => cleanup());

  const baseEntries = [
    { label: "Display", url: "http://test.local/display/ABCD23" },
    { label: "Dealer", url: "http://test.local/dealer/ABCD23?t=token" },
  ];

  it("does not re-fetch QR images when entry URLs are unchanged", async () => {
    vi.mocked(qrDataUrl).mockClear();
    const { rerender } = render(
      <QrDialog entries={[...baseEntries]} onClose={() => undefined} />,
    );
    await vi.waitFor(() => {
      expect(qrDataUrl).toHaveBeenCalledTimes(2);
    });
    vi.mocked(qrDataUrl).mockClear();
    rerender(<QrDialog entries={[...baseEntries]} onClose={() => undefined} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(qrDataUrl).not.toHaveBeenCalled();
  });

  it("shows Join entry when playerModeOn and joinUrl are set", async () => {
    render(
      <QrDialog
        entries={baseEntries}
        playerModeOn
        joinUrl="http://test.local/play/ABCD23"
        onClose={() => undefined}
      />,
    );
    await vi.waitFor(() => {
      expect(screen.getByText("Join (Player)")).toBeTruthy();
    });
    expect(screen.getByText("http://test.local/play/ABCD23")).toBeTruthy();
  });

  it("buildQrDialogEntries prepends Join when player mode is on", () => {
    const built = buildQrDialogEntries({
      entries: baseEntries,
      playerModeOn: true,
      joinUrl: "http://test.local/play/ABCD23",
    });
    expect(built[0]?.label).toBe("Join (Player)");
    expect(built).toHaveLength(3);
  });
});
