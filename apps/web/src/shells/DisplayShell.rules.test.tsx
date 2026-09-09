/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import { DisplayShell } from "./DisplayShell.js";

const baccarat = asUntypedModule(baccaratModule);

describe("DisplayShell rules reactivity", () => {
  afterEach(() => cleanup());

  it("shows prediction cells after SETTINGS_CHANGED", () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:${String(++n).padStart(2, "0")}.000Z`,
      id: () => `id-${n}`,
    });

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
    store.record(
      {
        cards: null,
        outcome: "P",
        playerTotal: null,
        bankerTotal: null,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );
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

    const { rerender } = render(
      <DisplayShell
        store={store}
        module={baccarat}
        rules={store.getRules()}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    expect(screen.queryByText("B?")).toBeNull();

    act(() => {
      store.emit({
        type: "SETTINGS_CHANGED",
        patch: { rules: { predictionCells: true } },
      });
    });

    rerender(
      <DisplayShell
        store={store}
        module={baccarat}
        rules={store.getRules()}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    expect(screen.getAllByText("B?").length).toBeGreaterThan(0);
  });
});
