/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { createStubModule, houseSettings, STUB_RULES } from "@casino-lord/core/testing";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import { DisplayShell } from "./DisplayShell.js";

describe("DisplayShell betting", () => {
  afterEach(() => cleanup());

  function renderWithPlayers() {
    const module = asUntypedModule(createStubModule());
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: STUB_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "id-1",
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
    store.emit({ type: "BANK_ISSUED", playerId: "p1", amount: 500, reason: "buyin" });
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
        placedAt: "2026-01-01T00:00:02.000Z",
        originRoundId: "r1",
      },
    });

    render(
      <DisplayShell
        store={store}
        module={module}
        rules={STUB_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );
    return store;
  }

  it("shows bet totals on the strip", () => {
    renderWithPlayers();
    const strip = screen.getByTestId("betting-strip");
    expect(strip.textContent).toContain("HIGH");
    expect(strip.textContent).toContain("100");
  });

  it("shows bankroll column sorted by bankroll", () => {
    renderWithPlayers();
    expect(screen.getByTestId("player-bankroll").textContent).toBe("400");
  });
});
