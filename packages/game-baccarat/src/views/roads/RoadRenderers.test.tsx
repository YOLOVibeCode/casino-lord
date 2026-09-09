/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BACCARAT_RULES } from "../../rules.js";
import { roadsFromTokens, stateWithRoadTokens } from "../test-helpers.js";
import { BeadPlate } from "./BeadPlate.js";
import { BigRoad } from "./BigRoad.js";
import { DerivedRoad } from "./DerivedRoad.js";

describe("road renderers golden grids", () => {
  afterEach(() => cleanup());

  it("BBBBBBBBB dragon tail reaches row 6 then runs right", () => {
    const grid = roadsFromTokens("B B B B B B B B B").bigRoad;
    render(<BigRoad grid={grid} />);

    const row5Cells = screen.getAllByTestId(/^big-road-cell-5-/);
    const withBanker = row5Cells.filter((el) => el.getAttribute("aria-label")?.includes("Banker"));
    expect(withBanker.length).toBeGreaterThan(1);
    expect(grid.cols).toBeGreaterThan(1);
  });

  it("BPBPBPBP ping-pong creates many columns", () => {
    const grid = roadsFromTokens("B P B P B P B P").bigRoad;
    render(<BigRoad grid={grid} />);
    expect(grid.cols).toBe(8);
    expect(screen.getAllByLabelText(/^Player$/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/^Banker$/).length).toBeGreaterThan(0);
  });

  it("TTBPP provisional leading-tie cell", () => {
    const grid = roadsFromTokens("T T B P P").bigRoad;
    render(<BigRoad grid={grid} />);
    expect(screen.getByLabelText(/Leading ties, count 2/)).toBeTruthy();
  });

  it("BBTBP tie slash with count on prior result", () => {
    const grid = roadsFromTokens("B B T B P").bigRoad;
    render(<BigRoad grid={grid} />);
    expect(screen.getByLabelText(/Banker, Tie/)).toBeTruthy();
  });

  it("bead plate shows P/B/T letters", () => {
    const grid = roadsFromTokens("B P T").beadPlate;
    render(<BeadPlate grid={grid} />);
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.getByText("P")).toBeTruthy();
    expect(screen.getByText("T")).toBeTruthy();
  });

  it("prediction cells when rules.predictionCells is on", () => {
    const rules = { ...DEFAULT_BACCARAT_RULES, predictionCells: true };
    const state = stateWithRoadTokens("B P B P B", rules);
    render(
      <DerivedRoad
        grid={state.roads.bigEyeBoy}
        variant="big-eye-boy"
        predictions={state.roads.bigEyePredictions}
      />,
    );
    expect(screen.getAllByText("B?").length).toBeGreaterThan(0);
    expect(screen.getAllByText("P?").length).toBeGreaterThan(0);
  });
});
