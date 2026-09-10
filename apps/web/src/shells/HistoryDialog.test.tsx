/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import { UiProviders } from "../ui/test-providers.js";
import { HistoryDialog } from "./HistoryDialog.js";

const baccarat = asUntypedModule(baccaratModule);

describe("HistoryDialog", () => {
  afterEach(() => cleanup());

  it("requires confirm sheet before deleting a hand", async () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => `id-${n}`,
    });

    store.record({ cards: null, playerTotal: 8, bankerTotal: 9, outcome: "B" }, { quick: true });

    render(
      <UiProviders>
        <HistoryDialog
          store={store}
          module={baccarat}
          rules={DEFAULT_BACCARAT_RULES}
          onClose={() => {}}
          onEdit={() => {}}
        />
      </UiProviders>,
    );

    fireEvent.click(screen.getByTestId("history-row-0"));
    fireEvent.click(screen.getByTestId("history-delete-btn"));

    expect(screen.getByTestId("confirm-sheet")).toBeTruthy();
    expect(screen.getByTestId("confirm-sheet-confirm")).toBeTruthy();

    fireEvent.click(screen.getByTestId("confirm-sheet-cancel"));

    await waitFor(() => {
      expect(screen.queryByTestId("confirm-sheet")).toBeNull();
    });
    expect((store.getComposed().module as { results?: unknown[] }).results?.length).toBe(1);
  });
});
