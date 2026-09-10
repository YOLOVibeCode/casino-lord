/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { baccaratModule, DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { createStubModule, STUB_RULES } from "@casino-lord/core/testing";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import { DisplayShell } from "./DisplayShell.js";

const baccarat = asUntypedModule(baccaratModule);

describe("DisplayShell", () => {
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
    expect(screen.getByText(/CASINO LORD/)).toBeTruthy();
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
});
