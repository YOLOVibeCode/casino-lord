/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NumberGrid } from "./NumberGrid.js";

function renderGrid(overrides: Partial<Parameters<typeof NumberGrid>[0]> = {}) {
  const onSelect = vi.fn();
  const onConfirm = vi.fn();
  render(<NumberGrid wheel="european" selected={null} onSelect={onSelect} {...overrides} />);
  return { onSelect, onConfirm };
}

describe("NumberGrid", () => {
  afterEach(() => cleanup());

  it("selects a pocket on tap", () => {
    const { onSelect } = renderGrid();
    fireEvent.click(screen.getByTestId("number-cell-17"));
    expect(onSelect).toHaveBeenCalledWith(17);
  });

  it("shows 00 only on american wheel", () => {
    renderGrid({ wheel: "american" });
    expect(screen.getByTestId("number-cell-00")).toBeTruthy();
  });

  it("hides 00 on european wheel", () => {
    renderGrid({ wheel: "european" });
    expect(screen.queryByTestId("number-cell-00")).toBeNull();
  });

  it("calls onConfirm when confirm button clicked", () => {
    const onConfirm = vi.fn();
    renderGrid({ selected: 5, requireConfirm: true, onConfirm });
    fireEvent.click(screen.getByTestId("number-grid-confirm"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("disables confirm when nothing selected", () => {
    renderGrid({ requireConfirm: true, onConfirm: vi.fn() });
    expect((screen.getByTestId("number-grid-confirm") as HTMLButtonElement).disabled).toBe(true);
  });

  it("exposes aria-label on cells", () => {
    renderGrid();
    expect(screen.getByTestId("number-cell-17").getAttribute("aria-label")).toBe("17, black");
    expect(screen.getByTestId("number-cell-0").getAttribute("aria-label")).toBe("0, green");
  });

  it("selects via keyboard digits and Enter", () => {
    const { onSelect } = renderGrid();
    fireEvent.keyDown(document, { key: "1" });
    fireEvent.keyDown(document, { key: "7" });
    expect(onSelect).toHaveBeenCalledWith(17);
  });

  it("clears selection on Backspace", () => {
    const onSelect = vi.fn();
    renderGrid({ selected: 17, onSelect });
    fireEvent.keyDown(document, { key: "Backspace" });
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
