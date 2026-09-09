/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { createStubModule, houseSettings, STUB_RULES } from "@casino-lord/core/testing";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import { DealerShell } from "./DealerShell.js";

describe("DealerShell undo blocking", () => {
  afterEach(() => cleanup());

  it("shows explanation when undo blocked by next-round bets", () => {
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
    store.emit({ type: "BETS_OPENED", roundId: "r1" });
    store.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });
    store.record({ value: 15 }, { quick: false });
    store.emit({ type: "BETS_OPENED", roundId: "r2" });
    store.emit({
      type: "BET_PLACED",
      bet: {
        id: "b1",
        playerId: "p1",
        roundId: "r2",
        type: "high",
        amount: 50,
        declared: false,
        working: false,
        placedAt: "2026-01-01T00:00:05.000Z",
        originRoundId: "r2",
      },
    });

    render(
      <DealerShell
        store={store}
        module={module}
        rules={STUB_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
        onDeviceSettingsChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("undo-btn"));
    expect(screen.getByTestId("dealer-toast").textContent).toMatch(/next round/i);
  });
});
