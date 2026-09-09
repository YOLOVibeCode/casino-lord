/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import { DealerShell } from "./DealerShell.js";

const baccarat = asUntypedModule(baccaratModule);

function pickExpress(rank: string, suit: string) {
  fireEvent.click(screen.getByTestId(`suit-${suit}`));
  fireEvent.click(screen.getByTestId(`rank-${rank}`));
}

describe("DealerShell UI confirm", () => {
  afterEach(() => cleanup());

  it("enables confirm with CONFIRM BANKER 9 after UI card picks", async () => {
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

    fireEvent.click(screen.getByTestId("slot-P1"));
    pickExpress("7", "H");
    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());
    pickExpress("4", "D");
    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());
    pickExpress("K", "S");
    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());
    pickExpress("5", "C");

    await waitFor(() => {
      const btn = screen.getByTestId("confirm-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toContain("✓ CONFIRM BANKER 9");
    });
  });
});
