/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { blackjackModule } from "@casino-lord/game-blackjack";
import { crapsModule } from "@casino-lord/game-craps";
import type { PlacedBet } from "@casino-lord/core";
import { DEFAULT_ROULETTE_RULES, rouletteModule } from "@casino-lord/game-roulette";
import type { CrapsBetTarget } from "@casino-lord/game-craps";
import { houseSettings } from "@casino-lord/core/testing";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { LocationProvider } from "preact-iso";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import { PlayerShell } from "./PlayerShell.js";
import "./player-shell.css";

function renderPlayerShell(props: Parameters<typeof PlayerShell>[0]) {
  return render(
    <LocationProvider>
      <PlayerShell {...props} />
    </LocationProvider>,
  );
}

function asSyncStore(
  store: ReturnType<typeof createTableStore>,
  opts?: {
    getPlayerId?: () => string;
    getRejectReason?: () => string | null;
    getConnectionState?: () => "connected" | "reconnecting" | "offline";
  },
): SyncStore {
  return {
    ...store,
    getPlayerId: opts?.getPlayerId ?? (() => "p1"),
    getConnectionState: opts?.getConnectionState ?? (() => "connected" as const),
    getRejectReason: opts?.getRejectReason ?? (() => null),
    getPresence: () => ({ dealers: 0, displays: 0, players: [] }),
    isReadOnly: () => false,
    takeover: () => {},
    destroy: () => {},
    getDealerToken: () => null,
    getPendingPlayers: () => [],
    sendAdmit: () => {},
    getVirtualStatus: () => null,
    getVirtualPending: () => null,
  } as SyncStore;
}

describe("PlayerShell", () => {
  afterEach(() => cleanup());

  function setupStore(opts?: {
    bankroll?: number;
    roundOpen?: boolean;
    playerStatus?: "active" | "pending" | "removed";
    getRejectReason?: () => string | null;
    getConnectionState?: () => "connected" | "reconnecting" | "offline";
  }) {
    const module = asUntypedModule(baccaratModule);
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "bet-id-1",
    });

    store.emit({ type: "PARTICIPATION_CHANGED", participation: houseSettings().participation });
    store.emit({
      type: "SETTINGS_CHANGED",
      patch: { bank: { ...houseSettings().bank, chipDenominations: [5, 25, 100, 500] } },
    });
    store.emit({
      type: "PLAYER_JOINED",
      player: {
        id: "p1",
        name: "Ana",
        color: "#e5322d",
        status: opts?.playerStatus ?? "active",
        joinedAt: "2026-01-01T00:00:01.000Z",
      },
    });
    store.emit({
      type: "BANK_ISSUED",
      playerId: "p1",
      amount: opts?.bankroll ?? 500,
      reason: "buyin",
    });

    if (opts?.roundOpen !== false) {
      store.emit({ type: "BETS_OPENED", roundId: "r1" });
    }

    const syncStore = asSyncStore(store, {
      getRejectReason: opts?.getRejectReason,
      getConnectionState: opts?.getConnectionState,
    });

    return { store: syncStore, module };
  }

  it("renders baccarat player view", () => {
    const { store } = setupStore();
    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.getByTestId("baccarat-player-view")).toBeTruthy();
  });

  it("PLACE emits BET_PLACED with roundId", () => {
    const { store } = setupStore();
    const emitSpy = vi.spyOn(store, "emit");
    renderPlayerShell({ store, playerName: "Ana" });

    fireEvent.click(screen.getByTestId("chip-denom-100"));
    const zone = screen.getByTestId("felt-zone-banker");
    fireEvent.mouseDown(zone);
    fireEvent.mouseUp(zone);
    fireEvent.click(screen.getByTestId("bet-slip-place"));

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "BET_PLACED",
        bet: expect.objectContaining({
          playerId: "p1",
          roundId: "r1",
          type: "banker",
          amount: 100,
        }),
      }),
    );
  });

  it("shows validation when bets closed", () => {
    const { store } = setupStore({ roundOpen: false });
    store.emit({ type: "BETS_OPENED", roundId: "r1" });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });

    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.getByTestId("bet-slip-locked")).toBeTruthy();
  });

  it("shows insufficient bankroll toast", () => {
    const { store } = setupStore({ bankroll: 50 });
    renderPlayerShell({ store, playerName: "Ana" });

    fireEvent.click(screen.getByTestId("chip-denom-100"));
    const zone = screen.getByTestId("felt-zone-banker");
    fireEvent.mouseDown(zone);
    fireEvent.mouseUp(zone);
    expect(screen.getByTestId("player-toast").textContent).toContain("Insufficient");
  });

  it("shows over max validation toast", () => {
    const { store } = setupStore();
    store.emit({
      type: "SETTINGS_CHANGED",
      patch: { bank: { ...houseSettings().bank, tableMax: 50, chipDenominations: [5, 25, 100] } },
    });
    renderPlayerShell({ store, playerName: "Ana" });

    fireEvent.click(screen.getByTestId("chip-denom-100"));
    const zone = screen.getByTestId("felt-zone-banker");
    fireEvent.mouseDown(zone);
    fireEvent.mouseUp(zone);
    expect(screen.getByTestId("player-toast").textContent).toContain("Maximum");
  });

  it("emits BET_REMOVED when removing placed bet from slip", () => {
    const { store } = setupStore();
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "banker",
        amount: 100,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });
    const emitSpy = vi.spyOn(store, "emit");
    renderPlayerShell({ store, playerName: "Ana" });
    fireEvent.click(screen.getByTestId("bet-slip-remove-b1"));
    expect(emitSpy).toHaveBeenCalledWith({ type: "BET_REMOVED", betId: "b1" });
  });

  it("shows settlement summary for quick entry with null totals", () => {
    const { store } = setupStore();
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "banker",
        amount: 100,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });
    store.record(
      {
        cards: null,
        outcome: "B",
        playerTotal: null,
        bankerTotal: null,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );
    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.getByTestId("player-status-bar").textContent).toContain("Banker");
    expect(screen.getByTestId("player-status-bar").textContent).toContain("+95");
    expect(screen.getByTestId("player-status-bar").textContent).not.toContain("null");
  });

  it("persists settlement summary for at least 4 seconds", async () => {
    vi.useFakeTimers();
    const { store } = setupStore();
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "banker",
        amount: 100,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });
    renderPlayerShell({ store, playerName: "Ana" });
    await act(async () => {
      store.record(
        {
          cards: null,
          outcome: "B",
          playerTotal: 4,
          bankerTotal: 9,
          playerPair: false,
          bankerPair: false,
          natural: false,
        },
        { quick: true },
      );
    });
    expect(screen.getByTestId("player-status-bar").textContent).toContain("+95");
    await act(async () => {
      vi.advanceTimersByTime(3500);
    });
    expect(screen.getByTestId("player-status-bar").textContent).toContain("+95");
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId("player-status-bar").textContent).not.toContain("you won");
    vi.useRealTimers();
  });

  it("shows WIN badge on winning zone after settlement", () => {
    const { store } = setupStore();
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "banker",
        amount: 100,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });
    store.record(
      {
        cards: null,
        outcome: "B",
        playerTotal: null,
        bankerTotal: null,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );
    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.getByTestId("felt-zone-badge-banker").textContent).toBe("WIN");
  });

  it("shows settlement summary after banker win", () => {
    const { store } = setupStore();
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "banker",
        amount: 100,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });
    store.record(
      {
        cards: null,
        outcome: "B",
        playerTotal: 4,
        bankerTotal: 9,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );
    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.getByTestId("player-status-bar").textContent).toContain("Banker 9");
    expect(screen.getByTestId("player-status-bar").textContent).toContain("+95");
  });

  it("shows rebuy hint at zero bankroll", () => {
    const { store } = setupStore({ bankroll: 0 });
    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.getByTestId("player-rebuy-hint")).toBeTruthy();
  });

  it("shows session summary when SESSION_ENDED", () => {
    const { store } = setupStore();
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "banker",
        amount: 100,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });
    store.record(
      {
        cards: null,
        outcome: "B",
        playerTotal: 4,
        bankerTotal: 9,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );
    store.emit({
      type: "PLAYER_JOINED",
      player: {
        id: "p2",
        name: "Bob",
        color: "#3366cc",
        status: "active",
        joinedAt: "2026-01-01T00:00:03.000Z",
      },
    });
    store.emit({ type: "BANK_ISSUED", playerId: "p2", amount: 500, reason: "buyin" });
    store.emit({ type: "SESSION_ENDED" });
    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.getByTestId("player-session-summary")).toBeTruthy();
    expect(screen.getByTestId("player-session-issued").textContent).toBe("500");
    expect(screen.getByTestId("player-session-net").textContent).toBe("+95");
    expect(screen.getByTestId("player-session-bankroll").textContent).toBe("595");
    expect(screen.getByTestId("player-session-rank").textContent).toBe("#1");
    expect(screen.queryByTestId("player-bottom-bar")).toBeNull();
  });

  it("shows verify link on virtual table session end", async () => {
    const urls = await import("../sync/urls.js");
    const tableUrlSpy = vi
      .spyOn(urls, "tableUrl")
      .mockImplementation((path) => `https://test.example${path}`);
    const { store } = setupStore();
    store.emit({
      type: "PARTICIPATION_CHANGED",
      participation: {
        ...houseSettings().participation,
        outcomeSource: "virtual",
      },
    });
    store.emit({ type: "SESSION_ENDED" });
    renderPlayerShell({ store, playerName: "Ana" });
    const link = screen.getByTestId("player-session-verify-link") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(`https://test.example/verify?code=${store.code}`);
    tableUrlSpy.mockRestore();
  });

  it("history shows would pay in declared-bets mode", () => {
    const { store } = setupStore();
    store.emit({
      type: "PARTICIPATION_CHANGED",
      participation: { playerMode: "on", bank: "none", outcomeSource: "physical" },
    });
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "banker",
        amount: 100,
        declared: true,
        working: false,
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });
    store.record(
      {
        cards: null,
        outcome: "B",
        playerTotal: 4,
        bankerTotal: 9,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );
    renderPlayerShell({ store, playerName: "Ana" });
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByTestId("player-history-profit-b1").textContent).toBe("Pays +95 (no chips)");
  });

  it("opens player settings sheet and persists phoneAnimations", () => {
    window.localStorage.clear();
    const { store } = setupStore();
    renderPlayerShell({ store, playerName: "Ana" });
    fireEvent.click(screen.getByTestId("player-settings-open"));
    expect(screen.getByTestId("player-settings-sheet")).toBeTruthy();
    fireEvent.change(screen.getByTestId("player-phone-animations"), {
      target: { value: "off" },
    });
    const stored = JSON.parse(window.localStorage.getItem("casino-lord:device-settings") ?? "{}");
    expect(stored.phoneAnimations).toBe("off");
    expect(stored.shakeSensitivity).toBe(DEFAULT_DEVICE_SETTINGS.shakeSensitivity);
  });

  it("history tab shows outcome and profit after settlement", () => {
    const { store } = setupStore();
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "banker",
        amount: 100,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });
    store.record(
      {
        cards: null,
        outcome: "B",
        playerTotal: 4,
        bankerTotal: 9,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );
    renderPlayerShell({ store, playerName: "Ana" });
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByTestId("player-history-outcome-b1").textContent).toBe("win");
    expect(screen.getByTestId("player-history-profit-b1").textContent).toBe("+95");
    expect(screen.getByTestId("player-history-running-net-b1").textContent).toContain("+95");
  });

  it("shows fairness commitment on virtual table info tab", () => {
    const { store } = setupStore();
    store.emit({
      type: "PARTICIPATION_CHANGED",
      participation: {
        ...houseSettings().participation,
        outcomeSource: "virtual",
      },
    });
    store.emit({
      type: "SERIES_STARTED",
      seriesId: "s1",
      commit: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    });
    renderPlayerShell({ store, playerName: "Ana" });
    fireEvent.click(screen.getByLabelText("Information"));
    expect(screen.getByTestId("player-fairness-commit").textContent).toContain("abcdef0123456789");
  });

  it("renders turn prompt and emits PLAYER_ACTION from fake module", async () => {
    const fakeModule = asUntypedModule({
      ...baccaratModule,
      turn: () => ({
        playerId: "p1",
        prompt: "Your move: HIT · STAND",
        deadlineMs: Date.now() + 20_000,
      }),
      playerActions: [{ id: "hit", label: "HIT", action: "hit" }],
    });
    const games = await import("../table/games.js");
    const getGameSpy = vi.spyOn(games, "getGame").mockReturnValue({
      id: "baccarat",
      name: "Baccarat",
      module: fakeModule,
      enabled: true,
    });
    const { store } = setupStore();
    const emitSpy = vi.spyOn(store, "emit");
    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.getByTestId("player-status-bar").textContent).toContain("Your move");
    expect(screen.getByTestId("action-btn-hit")).toBeTruthy();
    fireEvent.click(screen.getByTestId("action-btn-hit"));
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "PLAYER_ACTION", playerId: "p1", action: "hit" }),
    );
    getGameSpy.mockRestore();
  });

  it("emits away after 60s hidden", () => {
    vi.useFakeTimers();
    const { store } = setupStore();
    const emitSpy = vi.spyOn(store, "emit");
    renderPlayerShell({ store, playerName: "Ana" });

    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(60_000);

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PLAYER_UPDATED",
        playerId: "p1",
        patch: { status: "away" },
      }),
    );

    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PLAYER_UPDATED",
        patch: { status: "active" },
      }),
    );

    vi.useRealTimers();
  });

  function setupGameStore(
    game: "roulette" | "craps" | "blackjack",
    opts?: {
      bankroll?: number;
      roundOpen?: boolean;
      outcomeSource?: "physical" | "virtual";
      playerSeat?: number;
    },
  ) {
    const modules = {
      roulette: asUntypedModule(rouletteModule),
      craps: asUntypedModule(crapsModule),
      blackjack: asUntypedModule(blackjackModule),
    } as const;
    const rules = {
      roulette: DEFAULT_ROULETTE_RULES,
      craps: crapsModule.defaultRules,
      blackjack: blackjackModule.defaultRules,
    } as const;

    const store = createTableStore({
      game,
      module: modules[game],
      rules: rules[game],
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "bet-id-1",
    });

    store.emit({
      type: "PARTICIPATION_CHANGED",
      participation: {
        ...houseSettings().participation,
        ...(opts?.outcomeSource ? { outcomeSource: opts.outcomeSource } : {}),
      },
    });
    store.emit({
      type: "SETTINGS_CHANGED",
      patch: { bank: { ...houseSettings().bank, chipDenominations: [5, 25, 100, 500] } },
    });
    store.emit({
      type: "PLAYER_JOINED",
      player: {
        id: "p1",
        name: "Ana",
        color: "#e5322d",
        status: "active",
        joinedAt: "2026-01-01T00:00:01.000Z",
        ...(opts?.playerSeat !== undefined ? { seat: opts.playerSeat } : {}),
      },
    });
    store.emit({
      type: "BANK_ISSUED",
      playerId: "p1",
      amount: opts?.bankroll ?? 500,
      reason: "buyin",
    });

    if (opts?.roundOpen !== false) {
      store.emit({ type: "BETS_OPENED", roundId: "r1" });
    }

    const syncStore = asSyncStore(store, {
      getPlayerId: () => "p1",
    });
    (syncStore as { sendVirtual: ReturnType<typeof vi.fn> }).sendVirtual = vi.fn();

    return { store: syncStore, module: modules[game] };
  }

  it("roulette place emits BET_PLACED with straight-17 target", () => {
    const { store } = setupGameStore("roulette");
    const emitSpy = vi.spyOn(store, "emit");
    renderPlayerShell({ store, playerName: "Ana" });

    fireEvent.click(screen.getByTestId("chip-denom-25"));
    fireEvent.click(screen.getByTestId("felt-hit-straight:17"));

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "BET_PLACED",
        bet: expect.objectContaining({
          playerId: "p1",
          roundId: "r1",
          type: "straight",
          amount: 25,
          target: { kind: "straight", pocket: 17 },
        }),
      }),
    );
  });

  it("virtual craps roll calls sendVirtual trigger", async () => {
    const { store } = setupGameStore("craps", { outcomeSource: "virtual" });
    const emitSpy = vi.spyOn(store, "emit");
    renderPlayerShell({ store, playerName: "Ana" });

    await act(async () => {
      fireEvent.click(screen.getByTestId("shooter-roll"));
    });

    expect(store.sendVirtual).toHaveBeenCalledWith("trigger");
    expect(emitSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "PLAYER_ACTION", action: { kind: "roll" } }),
    );
  });

  it("physical blackjack hit emits PLAYER_ACTION with intent", () => {
    const { store } = setupGameStore("blackjack", { playerSeat: 3, roundOpen: false });
    store.emit({
      type: "LIVE_INPUT",
      payload: {
        dealer: [{ rank: "7", suit: "S" }],
        seats: {
          3: [
            {
              cards: [
                { rank: "9", suit: "H" },
                { rank: "7", suit: "C" },
              ],
              doubled: false,
              fromSplit: false,
              surrendered: false,
              outcome: null,
            },
          ],
        },
      },
      source: "dealer",
    });
    const emitSpy = vi.spyOn(store, "emit");
    renderPlayerShell({ store, playerName: "Ana" });

    fireEvent.click(screen.getByTestId("action-btn-hit"));
    expect(emitSpy).toHaveBeenCalledWith({
      type: "PLAYER_ACTION",
      playerId: "p1",
      action: "hit",
      intent: true,
    });
  });

  it("virtual blackjack hit calls sendVirtual action", () => {
    const { store } = setupGameStore("blackjack", {
      playerSeat: 3,
      roundOpen: false,
    });
    store.emit({
      type: "LIVE_INPUT",
      payload: {
        dealer: [{ rank: "7", suit: "S" }],
        seats: {
          3: [
            {
              cards: [
                { rank: "9", suit: "H" },
                { rank: "7", suit: "C" },
              ],
              doubled: false,
              fromSplit: false,
              surrendered: false,
              outcome: null,
            },
          ],
        },
      },
      source: "dealer",
    });
    store.emit({
      type: "PARTICIPATION_CHANGED",
      participation: {
        ...houseSettings().participation,
        outcomeSource: "virtual",
      },
    });
    const emitSpy = vi.spyOn(store, "emit");
    renderPlayerShell({ store, playerName: "Ana" });

    fireEvent.click(screen.getByTestId("action-btn-hit"));
    expect(store.sendVirtual).toHaveBeenCalledWith("action", { playerId: "p1", action: "hit" });
    expect(emitSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "PLAYER_ACTION", action: "hit" }),
    );
  });

  it("craps toggle_working emits BET_UPDATED", () => {
    const { store } = setupGameStore("craps");
    const comeBet: PlacedBet<CrapsBetTarget> = {
      id: "come-8",
      playerId: "p1",
      roundId: "r1",
      type: "come",
      target: { kind: "point", value: 8 },
      amount: 25,
      declared: false,
      working: true,
      placedAt: "2026-01-01T00:00:02.000Z",
      originRoundId: "r1",
    };
    store.emit({ type: "BET_PLACED", bet: comeBet });
    const emitSpy = vi.spyOn(store, "emit");
    renderPlayerShell({ store, playerName: "Ana" });

    fireEvent.click(screen.getByTestId("come-chip-8"));
    fireEvent.click(screen.getByTestId("working-toggle"));

    expect(emitSpy).toHaveBeenCalledWith({
      type: "BET_UPDATED",
      betId: "come-8",
      patch: { working: false },
    });
  });

  it("craps take-down emits BET_REMOVED", () => {
    const { store } = setupGameStore("craps");
    const placeBet: PlacedBet<CrapsBetTarget> = {
      id: "place-6",
      playerId: "p1",
      roundId: "r1",
      type: "place",
      target: { kind: "point", value: 6 },
      amount: 30,
      declared: false,
      working: true,
      placedAt: "2026-01-01T00:00:02.000Z",
      originRoundId: "r1",
    };
    store.emit({ type: "BET_PLACED", bet: placeBet });
    const emitSpy = vi.spyOn(store, "emit");
    renderPlayerShell({ store, playerName: "Ana" });

    const placeBox = screen.getByTestId("place-box-6");
    const chip = placeBox.querySelector(".craps-player-view__place-chip");
    expect(chip).toBeTruthy();
    fireEvent.click(chip!);
    fireEvent.click(screen.getByTestId("working-take-down"));

    expect(emitSpy).toHaveBeenCalledWith({ type: "BET_REMOVED", betId: "place-6" });
  });

  it("blackjack selectSeat emits PLAYER_UPDATED with seat patch", () => {
    const { store } = setupGameStore("blackjack");
    const emitSpy = vi.spyOn(store, "emit");
    renderPlayerShell({ store, playerName: "Ana" });

    fireEvent.click(screen.getByTestId("seat-pick-3"));
    expect(emitSpy).toHaveBeenCalledWith({
      type: "PLAYER_UPDATED",
      playerId: "p1",
      patch: { seat: 3 },
    });
  });

  it("shows removed player card with Home button", () => {
    const { store } = setupStore({ playerStatus: "removed" });
    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.getByTestId("player-removed")).toBeTruthy();
    expect(screen.getByText("You were removed from this table by the dealer")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Home" })).toBeTruthy();
  });

  it("shows pending approval message when player is pending", () => {
    const { store } = setupStore({ playerStatus: "pending" });
    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.getByTestId("player-pending")).toBeTruthy();
    expect(screen.getByText("Waiting for the dealer to approve you…")).toBeTruthy();
  });

  it("shows idle status and bet slip before first round opens", () => {
    const { store } = setupStore({ roundOpen: false });
    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.getByTestId("player-status-bar").textContent).toContain(
      "Waiting for the dealer to open bets",
    );
    expect(screen.getByTestId("bet-slip-idle").textContent).toContain("Bets open soon");
  });

  it("hides bankroll when bank is none", () => {
    const { store } = setupStore();
    store.emit({
      type: "PARTICIPATION_CHANGED",
      participation: { playerMode: "on", bank: "none", outcomeSource: "physical" },
    });
    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.queryByTestId("player-bankroll")).toBeNull();
  });

  it("leaderboard tab shows play chips disclaimer", () => {
    const { store } = setupStore();
    renderPlayerShell({ store, playerName: "Ana" });
    fireEvent.click(screen.getByRole("tab", { name: "Leaderboard" }));
    expect(screen.getByTestId("player-leaderboard-disclaimer").textContent).toContain(
      "Play chips — no cash value",
    );
  });

  it("toasts server reject reason", async () => {
    let rejectReason: string | null = null;
    const { store } = setupStore({ getRejectReason: () => rejectReason });
    renderPlayerShell({ store, playerName: "Ana" });
    rejectReason = "SESSION_ENDED";
    await act(async () => {
      store.emit({ type: "SETTINGS_CHANGED", patch: { tableName: "T1" } });
    });
    expect(screen.getByTestId("player-toast").textContent).toContain("Bet not placed");
    expect(screen.getByTestId("player-toast").textContent).toContain("session ended");
  });

  it("toasts OFFLINE when placing while disconnected", () => {
    const { store } = setupStore({ getConnectionState: () => "offline" });
    renderPlayerShell({ store, playerName: "Ana" });
    fireEvent.click(screen.getByTestId("chip-denom-5"));
    const zone = screen.getByTestId("felt-zone-banker");
    fireEvent.mouseDown(zone);
    fireEvent.mouseUp(zone);
    fireEvent.click(screen.getByTestId("bet-slip-place"));
    expect(screen.getByTestId("player-toast").textContent).toContain("Bet not placed — offline");
  });

  it("footer tabs have tablist semantics", () => {
    const { store } = setupStore();
    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.getByRole("tablist", { name: "Player sections" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "History" }).getAttribute("aria-selected")).toBe(
      "false",
    );
  });

  it("history shows game-specific result description", () => {
    const { store } = setupStore();
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "banker",
        amount: 100,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });
    store.record(
      {
        cards: null,
        outcome: "B",
        playerTotal: 5,
        bankerTotal: 7,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );
    renderPlayerShell({ store, playerName: "Ana" });
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByTestId("player-history-result-b1").textContent).toBe("Banker 7 – Player 5");
  });

  it("roulette settlement status uses spin description", () => {
    const { store } = setupGameStore("roulette");
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "red",
        amount: 25,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });
    store.record({ pocket: 17 }, { quick: true });
    renderPlayerShell({ store, playerName: "Ana" });
    expect(screen.getByTestId("player-status-bar").textContent).toContain("17 Black");
  });
});
