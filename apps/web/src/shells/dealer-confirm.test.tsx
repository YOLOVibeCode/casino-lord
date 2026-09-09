/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import type { BaccaratState } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";

const baccarat = asUntypedModule(baccaratModule);
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import { DealerShell } from "./DealerShell.js";

describe("DealerShell confirm", () => {
  afterEach(() => {
    cleanup();
  });

  it("reflects baccaratModule.confirm after LIVE_INPUT for complete hand", () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => `id-${n}`,
    });

    render(
      <DealerShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    const confirmBtn = screen.getByTestId("confirm-btn") as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    act(() => {
      store.emit({
        type: "LIVE_INPUT",
        payload: {
          slots: {
            P1: { rank: "7", suit: "H" },
            B1: { rank: "4", suit: "H" },
            P2: { rank: "K", suit: "H" },
            B2: { rank: "5", suit: "H" },
          },
        },
        source: "dealer",
      });
    });

    const expected = baccaratModule.confirm(
      store.getComposed().module as BaccaratState,
      DEFAULT_BACCARAT_RULES,
    );
    expect(expected?.label).toBe("✓ CONFIRM BANKER 9");

    const updated = screen.getByTestId("confirm-btn") as HTMLButtonElement;
    expect(updated.disabled).toBe(false);
    expect(updated.textContent).toContain(expected!.label);
  });

  it("keeps confirm disabled for incomplete hand", () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:1${++n}.000Z`,
      id: () => `id-${n}`,
    });

    store.emit({
      type: "LIVE_INPUT",
      payload: { slots: { P1: { rank: "7", suit: "H" } } },
      source: "dealer",
    });

    render(
      <DealerShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    expect((screen.getByTestId("confirm-btn") as HTMLButtonElement).disabled).toBe(true);
  });
});
