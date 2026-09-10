/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStubModule, houseSettings, STUB_RULES } from "@casino-lord/core/testing";
import { blackjackModule, DEFAULT_BLACKJACK_RULES } from "@casino-lord/game-blackjack";
import { crapsModule, DEFAULT_CRAPS_RULES } from "@casino-lord/game-craps";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import { reissuePlayerToken } from "../sync/api.js";
import { qrDataUrl } from "../sync/qr.js";
import { PlayersDialog } from "./PlayersDialog.js";

vi.mock("../sync/config.js", () => ({
  getSyncBaseUrl: () => "http://test.local",
  isSyncConfigured: () => true,
  resolveSyncUrl: () => "http://test.local",
}));

vi.mock("../sync/api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../sync/api.js")>();
  return { ...actual, reissuePlayerToken: vi.fn() };
});

vi.mock("../sync/qr.js", () => ({
  qrDataUrl: vi.fn(async () => "data:image/png;base64,test"),
}));

function wrapSyncStore(store: ReturnType<typeof createTableStore>): SyncStore {
  const sendAdmit = vi.fn();
  return Object.assign(store, {
    getConnectionState: () => "connected" as const,
    getPresence: () => ({
      dealers: 1,
      displays: 0,
      players: [
        { id: "p1", connected: true },
        { id: "p2", connected: true },
        { id: "p3", connected: true },
      ],
    }),
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

function mockBaccaratSyncStore(opts?: { autoBuyIn?: boolean }): SyncStore {
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
    patch: {
      participation: houseSettings().participation,
      bank: { autoBuyIn: opts?.autoBuyIn ?? false },
    },
  });
  return Object.assign(wrapSyncStore(store), {
    getPendingPlayers: () => [{ id: "p1", name: "Ana", color: "#E53935" }],
  }) as SyncStore;
}

function mockStoreWithZeroBankroll(): SyncStore {
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
  return wrapSyncStore(store);
}

function mockCrapsSyncStore(): SyncStore {
  let seq = 0;
  const store = createTableStore({
    game: "craps",
    module: asUntypedModule(crapsModule),
    rules: DEFAULT_CRAPS_RULES,
    rng: () => 0,
    now: () => "2026-01-01T00:00:00.000Z",
    id: () => `e${++seq}`,
  });
  const wrapped = wrapSyncStore(store);
  const originalEmit = store.emit.bind(store);
  const emitSpy = vi.fn((body: Parameters<typeof store.emit>[0]) => {
    originalEmit(body);
  });
  return Object.assign(wrapped, { emit: emitSpy }) as SyncStore;
}

function joinPlayer(store: SyncStore, player: { id: string; name: string; color: string }): void {
  store.emit({
    type: "PLAYER_JOINED",
    player: {
      ...player,
      status: "active",
      joinedAt: "2026-01-01T00:00:00.000Z",
    },
  });
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
    const store = mockBaccaratSyncStore();
    render(<PlayersDialog store={store} onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId("approve-p1"));
    expect(store.sendAdmit).toHaveBeenCalledWith("p1", true);
  });

  it("hides shooter controls on non-craps tables", () => {
    const store = mockBaccaratSyncStore();
    render(<PlayersDialog store={store} onClose={() => undefined} />);
    expect(screen.queryByTestId("shooter-rotation-hint")).toBeNull();
    expect(screen.queryByTestId("shooter-badge-p1")).toBeNull();
    expect(screen.queryByTestId("make-shooter-p1")).toBeNull();
  });

  it("emits TURN_ASSIGNED when Make shooter is clicked", () => {
    const store = mockCrapsSyncStore();
    joinPlayer(store, { id: "p1", name: "Ana", color: "#E53935" });
    joinPlayer(store, { id: "p2", name: "Ben", color: "#1E88E5" });
    render(<PlayersDialog store={store} onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId("make-shooter-p2"));
    expect(store.emit).toHaveBeenCalledWith({
      type: "TURN_ASSIGNED",
      playerId: "p2",
      role: "shooter",
    });
  });

  it("shows shooter badge on current shooter", () => {
    const store = mockCrapsSyncStore();
    joinPlayer(store, { id: "p1", name: "Ana", color: "#E53935" });
    joinPlayer(store, { id: "p2", name: "Ben", color: "#1E88E5" });
    render(<PlayersDialog store={store} onClose={() => undefined} />);
    expect(screen.getByTestId("shooter-badge-p1")).toBeTruthy();
    expect(screen.queryByTestId("shooter-badge-p2")).toBeNull();
  });

  it("disables Make shooter while dice are live", () => {
    const store = mockCrapsSyncStore();
    joinPlayer(store, { id: "p1", name: "Ana", color: "#E53935" });
    joinPlayer(store, { id: "p2", name: "Ben", color: "#1E88E5" });
    store.emit({
      type: "LIVE_INPUT",
      payload: { a: 4, b: null },
      source: "dealer",
    });
    render(<PlayersDialog store={store} onClose={() => undefined} />);
    expect((screen.getByTestId("make-shooter-p2") as HTMLButtonElement).disabled).toBe(true);
  });

  it("badge follows shooter after seven-out auto-rotation", () => {
    const store = mockCrapsSyncStore();
    joinPlayer(store, { id: "p1", name: "Ana", color: "#E53935" });
    joinPlayer(store, { id: "p2", name: "Ben", color: "#1E88E5" });
    joinPlayer(store, { id: "p3", name: "Cy", color: "#43A047" });
    store.record({ a: 4, b: 4, total: 8, hard: null }, { quick: false });
    store.record({ a: 4, b: 3, total: 7, hard: null }, { quick: false });
    store.startNewSeries(undefined, { auto: true });
    const module = store.getComposed().module as { currentShooterId: string | null };
    expect(module.currentShooterId).toBe("p2");
    render(<PlayersDialog store={store} onClose={() => undefined} />);
    expect(screen.getByTestId("shooter-badge-p2")).toBeTruthy();
    expect(screen.queryByTestId("shooter-badge-p1")).toBeNull();
  });

  it("labels override rotation when shooterRotation is join_order", () => {
    const store = mockCrapsSyncStore();
    joinPlayer(store, { id: "p1", name: "Ana", color: "#E53935" });
    joinPlayer(store, { id: "p2", name: "Ben", color: "#1E88E5" });
    render(<PlayersDialog store={store} onClose={() => undefined} />);
    expect(screen.getByTestId("shooter-rotation-hint").textContent).toContain(
      "rotates in join order",
    );
    expect(screen.getByTestId("make-shooter-p2").textContent).toBe("Override rotation");
  });

  it("shows prominent assign hint when shooterRotation is dealer_assigns", () => {
    const store = mockCrapsSyncStore();
    store.emit({
      type: "SETTINGS_CHANGED",
      patch: { virtual: { shooterRotation: "dealer_assigns" } },
    });
    joinPlayer(store, { id: "p1", name: "Ana", color: "#E53935" });
    joinPlayer(store, { id: "p2", name: "Ben", color: "#1E88E5" });
    render(<PlayersDialog store={store} onClose={() => undefined} />);
    expect(screen.getByTestId("shooter-rotation-hint").textContent).toContain("Assign the shooter");
    expect(screen.getByTestId("make-shooter-p2").textContent).toBe("Make shooter");
    expect(screen.getByTestId("make-shooter-p2").className).toContain(
      "players-dialog__make-shooter--primary",
    );
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

  it("reissue encodes player token in URL and shows warning", async () => {
    vi.mocked(reissuePlayerToken).mockResolvedValue({ playerToken: "new-token" });
    const store = mockStoreWithZeroBankroll();
    render(<PlayersDialog store={store} onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId("reissue-p1"));
    await vi.waitFor(() => {
      expect(screen.getByTestId("reissue-link")).toBeTruthy();
    });
    const link = screen.getByTestId("reissue-link");
    expect(link.getAttribute("href")).toContain("?t=new-token");
    expect(screen.getByTestId("reissue-warning").textContent).toContain(
      "Anyone with this link can join as this player",
    );
    expect(qrDataUrl).toHaveBeenCalledWith(expect.stringContaining("?t=new-token"));
  });

  it("approve shows buy-in toast with one-tap issue action", async () => {
    const store = mockBaccaratSyncStore({ autoBuyIn: false });
    render(<PlayersDialog store={store} onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId("approve-p1"));
    expect(store.sendAdmit).toHaveBeenCalledWith("p1", true);
    expect(screen.getByTestId("players-toast").textContent).toContain("issue 500 chips");
    fireEvent.click(screen.getByTestId("players-toast-action"));
    const issued = store.events.find((e) => e.type === "BANK_ISSUED");
    expect(issued).toMatchObject({
      type: "BANK_ISSUED",
      playerId: "p1",
      amount: 500,
      reason: "buyin",
    });
  });

  it("shows Issue button when player bankroll is zero", () => {
    const store = mockStoreWithZeroBankroll();
    render(<PlayersDialog store={store} onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId("issue-buyin-p1"));
    const issued = store.events.find((e) => e.type === "BANK_ISSUED");
    expect(issued).toMatchObject({
      type: "BANK_ISSUED",
      playerId: "p1",
      amount: 500,
      reason: "buyin",
    });
  });
});
