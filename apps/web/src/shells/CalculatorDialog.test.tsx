/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { baccaratModule, DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import { CalculatorDialog } from "./CalculatorDialog.js";

describe("CalculatorDialog", () => {
  afterEach(() => cleanup());

  it("shows returns label for banker at 100", () => {
    const module = asUntypedModule(baccaratModule);
    const store = createTableStore({
      game: "baccarat",
      module,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "e1",
    });

    render(
      <CalculatorDialog
        store={store}
        module={module}
        rules={DEFAULT_BACCARAT_RULES}
        onClose={() => undefined}
      />,
    );

    const bankerRow = screen.getByTestId("calculator-row-banker");
    expect(bankerRow.textContent).toContain("returns 195");
    expect(bankerRow.textContent).not.toContain("ret 195");
  });
});
