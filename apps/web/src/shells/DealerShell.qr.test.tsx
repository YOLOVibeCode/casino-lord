/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocationProvider } from "preact-iso";
import { createStubModule, houseSettings, STUB_RULES } from "@casino-lord/core/testing";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import { UiProviders } from "../ui/test-providers.js";
import { DealerShell } from "./DealerShell.js";

vi.mock("../sync/urls.js", () => ({
  appBaseUrl: () => "http://table.local",
  tableUrl: (path: string) => `http://table.local${path}`,
}));

vi.mock("../sync/qr.js", () => ({
  qrDataUrl: async (url: string) => `data:qr,${url}`,
  qrSvg: async () => "<svg></svg>",
}));

const module = asUntypedModule(createStubModule());

function syncStoreFor(options: { withPlayers: boolean; sessionEnded?: boolean }): SyncStore {
  const store = createTableStore({
    game: "baccarat",
    module,
    rules: STUB_RULES,
    rng: () => 0,
    now: () => "2026-01-01T00:00:00.000Z",
    id: () => "s1",
  });

  if (options.withPlayers) {
    store.emit({ type: "PARTICIPATION_CHANGED", participation: houseSettings().participation });
  }
  if (options.sessionEnded) {
    store.emit({ type: "SESSION_ENDED" });
  }

  return Object.assign(store, {
    getConnectionState: () => "connected" as const,
    getPresence: () => ({ dealers: 1, displays: 1, players: [] }),
    isReadOnly: () => false,
    getRejectReason: () => null,
    takeover: vi.fn(),
    destroy: vi.fn(),
    getDealerToken: () => "dealer-token",
    getPlayerId: () => null,
    getPendingPlayers: () => [],
    sendAdmit: vi.fn(),
    getVirtualStatus: () => null,
    getVirtualPending: () => null,
  }) as unknown as SyncStore;
}

function openQrDialog(store: SyncStore): void {
  render(
    <UiProviders>
      <LocationProvider>
        <DealerShell
          store={store}
          module={module}
          rules={STUB_RULES}
          deviceSettings={DEFAULT_DEVICE_SETTINGS}
          onDeviceSettingsChange={() => {}}
        />
      </LocationProvider>
    </UiProviders>,
  );
  fireEvent.click(screen.getByTestId("menu-btn"));
  fireEvent.click(screen.getByTestId("menu-show-qr"));
}

describe("DealerShell — Show QR", () => {
  afterEach(() => cleanup());

  it("offers a player Join QR on a with-players table", async () => {
    const store = syncStoreFor({ withPlayers: true });
    openQrDialog(store);

    const dialog = screen.getByTestId("qr-dialog");
    expect(dialog.textContent).toContain("Join (Player)");
    // The dealer holds up this dialog for guests to scan: the join link must be
    // there, or they scan Display (read-only board) or Dealer (full control).
    expect(dialog.textContent).toContain(`http://table.local/play/${store.code}`);

    await vi.waitFor(() => {
      const images = screen.getAllByTestId("qr-image");
      expect(images.map((img) => img.getAttribute("src"))).toContain(
        `data:qr,http://table.local/play/${store.code}`,
      );
    });
  });

  it("lists Join first, before the dealer control link", () => {
    openQrDialog(syncStoreFor({ withPlayers: true }));

    const headings = Array.from(
      screen.getByTestId("qr-dialog").querySelectorAll("h3"),
      (h) => h.textContent,
    );
    expect(headings).toEqual(["Join (Player)", "Display", "Dealer"]);
  });

  it("still warns that the dealer link controls the table", () => {
    openQrDialog(syncStoreFor({ withPlayers: true }));

    expect(screen.getByTestId("qr-dialog").textContent).toContain(
      "Anyone with this link can control the table",
    );
  });

  it("omits the Join QR on a dealer-only table", () => {
    const store = syncStoreFor({ withPlayers: false });
    openQrDialog(store);

    const dialog = screen.getByTestId("qr-dialog");
    expect(dialog.textContent).not.toContain("Join (Player)");
    expect(dialog.textContent).not.toContain(`/play/${store.code}`);
  });

  it("omits the Join QR once the session has ended", () => {
    const store = syncStoreFor({ withPlayers: true, sessionEnded: true });
    openQrDialog(store);

    expect(screen.getByTestId("qr-dialog").textContent).not.toContain("Join (Player)");
  });
});
