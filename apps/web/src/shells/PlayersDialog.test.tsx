/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStubModule, houseSettings, STUB_RULES } from "@casino-lord/core/testing";
import { blackjackModule, DEFAULT_BLACKJACK_RULES } from "@casino-lord/game-blackjack";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import { PlayersDialog } from "./PlayersDialog.js";

function mockSyncStore(): SyncStore {
  const module = asUntypedModule(createStubModule());
  const store = createTableStore({
    game: "baccarat",
    module,
    rules: STUB_RULES,
    rng: () => 0,
    now: () => "2026-01-01T00:00:00.000Z",
    id: () => "e1",
  });
  store.emit({
    type: "SETTINGS_CHANGED",
    patch: { participation: houseSettings().participation },
  });

  const sendAdmit = vi.fn();
  return Object.assign(store, {
    getConnectionState: () => "connected" as const,
    getPresence: () => ({ dealers: 1, displays: 0, players: [] }),
    isReadOnly: () => false,
    getRejectReason: () => null,
    takeover: vi.fn(),
    destroy: vi.fn(),
    getDealerToken: () => "dealer-token",
    getPlayerId: () => null,
    getPendingPlayers: () => [{ id: "p1", name: "Ana", color: "#E53935" }],
    sendAdmit,
  }) as SyncStore;
}

function mockBlackjackStore(assign: "dealer" | "player"): SyncStore {
  const module = asUntypedModule({
    ...blackjackModule,
    seats: { max: DEFAULT_BLACKJACK_RULES.seats, assign },
  });
  const store = createTableStore({
    game: "blackjack",
    module,
    rules: DEFAULT_BLACKJACK_RULES,
    rng: () => 0,
    now: () => "2026-01-01T00:00:00.000Z",
    id: () => "e1",
  });
  store.emit({
    type: "PLAYER_JOINED",
    player: {
      id: "p1",
      name: "Ana",
      color: "#E53935",
      status: "active",
      joinedAt: "2026-01-01T00:00:00.000Z",
    },
  });

  const sendAdmit = vi.fn();
  return Object.assign(store, {
    getConnectionState: () => "connected" as const,
    getPresence: () => ({ dealers: 1, displays: 0, players: [{ id: "p1", connected: true }] }),
    isReadOnly: () => false,
    getRejectReason: () => null,
    takeover: vi.fn(),
    destroy: vi.fn(),
    getDealerToken: () => "dealer-token",
    getPlayerId: () => null,
    getPendingPlayers: () => [],
    sendAdmit,
  }) as SyncStore;
}

describe("PlayersDialog", () => {
  afterEach(() => cleanup());

  it("approve sends admit message", () => {
    const store = mockSyncStore();
    render(<PlayersDialog store={store} onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId("approve-p1"));
    expect(store.sendAdmit).toHaveBeenCalledWith("p1", true);
  });

  it("emits PLAYER_UPDATED with seat when dealer assigns on blackjack tables", () => {
    const store = mockBlackjackStore("dealer");
    const emitSpy = vi.spyOn(store, "emit");
    render(
      <PlayersDialog
        store={store}
        seatsConfig={{ max: DEFAULT_BLACKJACK_RULES.seats, assign: "dealer" }}
        onClose={() => undefined}
      />,
    );

    fireEvent.change(screen.getByTestId("seat-select-p1"), { target: { value: "4" } });

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PLAYER_UPDATED",
        playerId: "p1",
        patch: { seat: 4 },
      }),
    );
  });

  it("hides seat select when assign mode is player", () => {
    const store = mockBlackjackStore("player");
    render(
      <PlayersDialog
        store={store}
        seatsConfig={{ max: DEFAULT_BLACKJACK_RULES.seats, assign: "player" }}
        onClose={() => undefined}
      />,
    );
    expect(screen.queryByTestId("seat-select-p1")).toBeNull();
  });
});
