/**
 * @vitest-environment jsdom
 */
import type { LayoutPreset } from "@casino-lord/core";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BACCARAT_RULES } from "../rules.js";
import { initialState } from "../state.js";
import { DisplayView } from "./DisplayView.js";
import { stateWithRoadTokens } from "./test-helpers.js";

const TABLE = {
  code: "TEST01",
  game: "baccarat" as const,
  seriesNumber: 1,
  resultIndex: 0,
  participation: { playerMode: "off" as const, virtualOutcomes: false },
  playerCount: 0,
};

const EMPTY_BETS = { round: null, summaries: [], openBets: [] };

function renderDisplay(layoutId: string, state = stateWithRoadTokens("B P B")) {
  const layout: LayoutPreset = { id: layoutId, label: layoutId };
  return render(
    <DisplayView
      state={state}
      rules={DEFAULT_BACCARAT_RULES}
      table={TABLE}
      bets={EMPTY_BETS}
      layout={layout}
    />,
  );
}

describe("DisplayView", () => {
  afterEach(() => cleanup());

  it("classic layout includes current-hand panel", () => {
    renderDisplay("classic");
    expect(screen.getByTestId("current-hand-panel")).toBeTruthy();
    expect(screen.getByTestId("display-view").getAttribute("data-layout")).toBe("classic");
  });

  it("roads-only omits current-hand panel", () => {
    renderDisplay("roads-only");
    expect(screen.queryByTestId("current-hand-panel")).toBeNull();
  });

  it("shows result banner after recorded hands with empty live slots", () => {
    const state = stateWithRoadTokens("B");
    renderDisplay("classic", state);
    expect(screen.getByTestId("result-banner").textContent).toContain("BANKER WINS");
  });

  it("prediction cells only when rule enabled", () => {
    const rules = { ...DEFAULT_BACCARAT_RULES, predictionCells: true };
    const state = stateWithRoadTokens("B P B", rules);
    render(
      <DisplayView
        state={state}
        rules={rules}
        table={TABLE}
        bets={EMPTY_BETS}
        layout={{ id: "classic", label: "Classic" }}
      />,
    );
    expect(screen.getAllByText("B?").length).toBeGreaterThan(0);
  });

  it("no prediction labels when rule disabled", () => {
    renderDisplay("classic");
    expect(screen.queryByText("B?")).toBeNull();
  });

  it("footer stats show pair and natural counts", () => {
    const state = initialState();
    renderDisplay("classic", state);
    expect(screen.getByTestId("footer-player-pairs").textContent).toContain("0");
    expect(screen.getByTestId("footer-naturals").textContent).toContain("0");
  });
});
