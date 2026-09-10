/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { baccaratModule, DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { createStubModule, houseSettings, STUB_RULES } from "@casino-lord/core/testing";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import { DisplayShell } from "./DisplayShell.js";

const baccarat = asUntypedModule(baccaratModule);

function asSyncStore(
  store: ReturnType<typeof createTableStore>,
  getConnectionState: () => "connected" | "reconnecting" | "offline",
): SyncStore {
  return {
    ...store,
    getConnectionState,
    getPresence: () => ({ dealers: 1, displays: 0, players: [] }),
    isReadOnly: () => false,
    takeover: () => {},
    destroy: () => {},
    getDealerToken: () => null,
    getPlayerId: () => null,
    getPendingPlayers: () => [],
    sendAdmit: () => {},
    getVirtualStatus: () => null,
    getVirtualPending: () => null,
    getRejectReason: () => null,
  } as SyncStore;
}

describe("DisplayShell", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders header with stub module", () => {
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    render(
      <DisplayShell
        store={store}
        module={module}
        rules={STUB_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    expect(screen.getByTestId("display-shell")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Table info" }).textContent).toMatch(/CASINO LORD/);
  });

  it("shows on-board VIRTUAL tag when outcomeSource is virtual", () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });
    store.emit({
      type: "PARTICIPATION_CHANGED",
      participation: { playerMode: "off", bank: "none", outcomeSource: "virtual" },
    });

    render(
      <DisplayShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    expect(screen.getByTestId("virtual-board-tag")).toBeTruthy();
  });

  it("formats stats labels for EN+ZH board language", () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    render(
      <DisplayShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={{ ...DEFAULT_DEVICE_SETTINGS, boardLanguage: "EN+ZH" }}
      />,
    );

    expect(screen.getByText(/Player \/ 闲:/)).toBeTruthy();
  });

  it("shows history re-evaluated toast when edit changes settlements", () => {
    const module = asUntypedModule(createStubModule());
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
      id: () => `id-${n}`,
    });

    store.emit({ type: "PARTICIPATION_CHANGED", participation: houseSettings().participation });
    store.emit({
      type: "PLAYER_JOINED",
      player: {
        id: "p1",
        name: "Ana",
        color: "#f00",
        status: "active",
        joinedAt: "2026-01-01T00:00:01.000Z",
      },
    });
    store.emit({
      type: "BANK_ISSUED",
      playerId: "p1",
      amount: 500,
      reason: "buyin",
    });
    store.emit({ type: "BETS_OPENED", roundId: "r1" });
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r1",
        type: "high",
        amount: 100,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:05.000Z",
        originRoundId: "r1",
      },
    });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });
    store.record({ value: 15 }, { quick: false });

    render(
      <DisplayShell
        store={store}
        module={module}
        rules={STUB_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    const recorded = (store.getComposed().module as { results: { id: string; value: number }[] })
      .results[0]!;
    act(() => {
      store.editResult({
        id: recorded.id,
        index: 0,
        recordedAt: "2026-01-01T00:00:10.000Z",
        quick: false,
        source: "physical",
        by: "dealer",
        data: { value: 5 },
        roundId: "r1",
      });
    });

    expect(screen.getByTestId("history-toast").textContent).toMatch(/history re-evaluated/i);
    expect(screen.getByTestId("history-toast").textContent).toMatch(/1 bet\(s\) affected/i);
  });

  it("activates idle attract after 90s without events and clears on next event", () => {
    vi.useFakeTimers();
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    render(
      <DisplayShell
        store={store}
        module={module}
        rules={STUB_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    expect(screen.getByTestId("display-shell").className).toContain("display-shell--idle-attract");

    act(() => {
      store.emit({ type: "SETTINGS_CHANGED", patch: {} });
    });
    expect(screen.getByTestId("display-shell").className).not.toContain(
      "display-shell--idle-attract",
    );
  });

  it("shows offline banner and reconnecting pill from sync connection state", () => {
    const module = asUntypedModule(createStubModule());
    const baseStore = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    const offlineStore = asSyncStore(baseStore, () => "offline");
    const { unmount } = render(
      <DisplayShell
        store={offlineStore}
        module={module}
        rules={STUB_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );
    expect(screen.getByTestId("connection-banner").textContent).toContain(
      "Reconnecting to dealer — board may be behind",
    );
    unmount();

    render(
      <DisplayShell
        store={asSyncStore(baseStore, () => "reconnecting")}
        module={module}
        rules={STUB_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );
    expect(screen.getByTestId("connection-pill").textContent).toContain("Reconnecting");
    expect(screen.queryByTestId("connection-banner")).toBeNull();
  });

  it("shows corner hint toasts that auto-dismiss without blocking the board", () => {
    vi.useFakeTimers();
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    render(
      <DisplayShell
        store={store}
        module={module}
        rules={STUB_RULES}
        deviceSettings={{ ...DEFAULT_DEVICE_SETTINGS, fullScreen: false, soundEnabled: true }}
      />,
    );

    const fsHint = screen.getByTestId("fs-hint");
    const soundHint = screen.getByTestId("sound-unlock-hint");
    expect(fsHint.className).toContain("display-shell__hint-toast");
    expect(soundHint.className).toContain("display-shell__hint-toast");
    expect(screen.getByTestId("display-shell").contains(screen.getByTestId("display-shell"))).toBe(
      true,
    );

    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.queryByTestId("fs-hint")).toBeNull();
    expect(screen.queryByTestId("sound-unlock-hint")).toBeNull();
  });

  it("does not activate idle attract when device setting is off", () => {
    vi.useFakeTimers();
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    render(
      <DisplayShell
        store={store}
        module={module}
        rules={STUB_RULES}
        deviceSettings={{ ...DEFAULT_DEVICE_SETTINGS, idleAttract: false }}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    expect(screen.getByTestId("display-shell").className).not.toContain(
      "display-shell--idle-attract",
    );
  });
});
