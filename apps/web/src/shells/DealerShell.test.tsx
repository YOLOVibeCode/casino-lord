/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { createStubModule, STUB_RULES } from "@casino-lord/core/testing";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import { DealerShell } from "./DealerShell.js";

describe("DealerShell", () => {
  it("renders header and action bar with stub module", () => {
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
      <DealerShell
        store={store}
        module={module}
        rules={STUB_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
      />,
    );

    expect(screen.getByTestId("dealer-shell")).toBeTruthy();
    expect(screen.getByTestId("undo-btn")).toBeTruthy();
    expect(screen.getByTestId("confirm-btn")).toBeTruthy();
    expect(screen.getByText(store.code)).toBeTruthy();
  });
});
