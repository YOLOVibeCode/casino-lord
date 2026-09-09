/**
 * @vitest-environment jsdom
 */
import type { LayoutPreset } from "@casino-lord/core";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CRAPS_RULES } from "../rules.js";
import { DisplayView } from "./DisplayView.js";
import { stateWithRollTokens } from "./test-helpers.js";

const TABLE = {
  code: "TEST01",
  game: "craps" as const,
  seriesNumber: 1,
  resultIndex: 0,
  participation: { playerMode: "off" as const, virtualOutcomes: false },
  playerCount: 0,
};

const EMPTY_BETS = { round: null, summaries: [], openBets: [] };

function renderDisplay(layoutId: string, state = stateWithRollTokens("4-4")) {
  const layout: LayoutPreset = { id: layoutId, label: layoutId };
  return render(
    <DisplayView
      state={state}
      rules={DEFAULT_CRAPS_RULES}
      table={TABLE}
      bets={EMPTY_BETS}
      layout={layout}
    />,
  );
}

describe("DisplayView", () => {
  afterEach(() => cleanup());

  it("shows puck ON over established point", () => {
    renderDisplay("classic");
    expect(screen.getByTestId("puck").textContent).toBe("ON");
    expect(screen.getByTestId("point-box-8")).toBeTruthy();
  });

  it("clears puck after seven-out", () => {
    const state = stateWithRollTokens("4-4 7");
    renderDisplay("classic", state);
    expect(screen.getByTestId("puck").textContent).toBe("OFF");
  });

  it("shows history badges for point made", () => {
    renderDisplay("classic", stateWithRollTokens("4-4 4-4"));
    expect(screen.getByText("✔")).toBeTruthy();
  });

  it("switches layout via data-layout", () => {
    renderDisplay("history-focus");
    expect(screen.getByTestId("display-view").getAttribute("data-layout")).toBe("history-focus");
  });
});
