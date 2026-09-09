/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { createStubModule, houseSettings, STUB_RULES } from "@casino-lord/core/testing";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import { BankPanel } from "./BankPanel.js";

describe("BankPanel", () => {
  afterEach(() => cleanup());

  function setupStore() {
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
    return store;
  }

  it("emits BANK_ISSUED when issuing chips", () => {
    const store = setupStore();
    render(
      <BankPanel
        store={store}
        composed={store.getComposed()}
        settings={houseSettings()}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("issue-one"));
    const issued = store.events.find((e) => e.type === "BANK_ISSUED");
    expect(issued?.type).toBe("BANK_ISSUED");
  });

  it("shows chips in play summary", () => {
    const store = setupStore();
    store.emit({ type: "BANK_ISSUED", playerId: "p1", amount: 500, reason: "buyin" });
    render(
      <BankPanel
        store={store}
        composed={store.getComposed()}
        settings={houseSettings()}
        onClose={() => {}}
      />,
    );

    expect(screen.getByTestId("chips-summary").textContent).toContain("Issued: 500");
  });
});
