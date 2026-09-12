/**
 * @vitest-environment jsdom
 */
import type { BetsView, LayoutPreset } from "@casino-lord/core";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_ROULETTE_RULES } from "../rules.js";
import { DisplayView } from "./DisplayView.js";
import { stateWithSpins } from "./test-helpers.js";

const EMPTY_BETS: BetsView = { open: false, placed: [], pending: [] };

const TABLE = {
  code: "TEST01",
  game: "roulette" as const,
  outcomeSource: "physical" as const,
  participation: { playerMode: "off" as const, virtualOutcomes: false },
  createdAt: "2026-01-01T00:00:00.000Z",
};

function renderDisplay(layoutId: string, body?: string) {
  const layout: LayoutPreset = { id: layoutId, label: layoutId, aspect: "16:9" };
  const state = body ? stateWithSpins(body) : stateWithSpins("17 32 0 5 22 14 19 8 36 1");
  render(
    <DisplayView
      state={state}
      rules={DEFAULT_ROULETTE_RULES}
      table={TABLE}
      bets={EMPTY_BETS}
      layout={layout}
    />,
  );
  return state;
}

describe("DisplayView", () => {
  afterEach(() => cleanup());

  it("shows 10-spin history with colour classes", () => {
    renderDisplay("classic");
    expect(screen.getByTestId("history-chip-1")).toBeTruthy();
    expect(screen.getByTestId("history-chip-0").className).toContain("--green");
    expect(screen.getByTestId("history-chip-17").className).toContain("--black");
  });

  it("orders hot numbers by hit count", () => {
    const state = renderDisplay("classic", "1 1 1 2 3");
    expect(state.hot[0]).toBe(1);
    expect(screen.getByTestId("hot-1")).toBeTruthy();
  });

  it("switches layout via data-layout", () => {
    renderDisplay("wheel-focus");
    expect(screen.getByTestId("display-view").getAttribute("data-layout")).toBe("wheel-focus");
  });

  it("renders wheel with data-pocket cells", () => {
    renderDisplay("classic");
    expect(screen.getByTestId("roulette-wheel")).toBeTruthy();
    expect(document.querySelector('[data-pocket="17"]')).toBeTruthy();
  });

  it("draws a ball in the winning pocket", () => {
    renderDisplay("classic");
    expect(screen.getByTestId("wheel-ball")).toBeTruthy();
  });
});
