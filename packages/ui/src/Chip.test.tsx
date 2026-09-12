/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { Chip, ChipStack, chipColor, splitChipAmount } from "./Chip.js";

describe("chipColor", () => {
  it("maps denominations to casino colors", () => {
    expect(chipColor(5).fill).toBe("#dc2626");
    expect(chipColor(25).fill).toBe("#15803d");
    expect(chipColor(100).fill).toBe("#171717");
    expect(chipColor(500).fill).toBe("#6d28d9");
    expect(chipColor(1000).fill).toBe("#c9a227");
  });
});

describe("splitChipAmount", () => {
  it("splits greedily by denomination", () => {
    expect(splitChipAmount(130).denoms).toEqual([100, 25, 5]);
    expect(splitChipAmount(130).overflow).toBe(0);
  });

  it("caps visible chips and reports overflow", () => {
    const split = splitChipAmount(6000, 6);
    expect(split.denoms).toHaveLength(6);
    expect(split.overflow).toBe(0);
    const many = splitChipAmount(8000, 6);
    expect(many.denoms).toHaveLength(6);
    expect(many.overflow).toBeGreaterThan(0);
  });
});

describe("Chip", () => {
  afterEach(() => cleanup());

  it("labels the denomination", () => {
    render(<Chip denom={100} testId="chip-100" />);
    expect(screen.getByTestId("chip-100").getAttribute("aria-label")).toBe("100 chip");
  });
});

describe("ChipStack", () => {
  afterEach(() => cleanup());

  it("renders nothing for zero", () => {
    const { container } = render(<ChipStack amount={0} testId="empty-stack" />);
    expect(container.querySelector("[data-testid=empty-stack]")).toBeNull();
  });

  it("stacks chips for an amount", () => {
    render(<ChipStack amount={130} testId="stack" showAmount />);
    expect(screen.getByTestId("stack").textContent).toContain("130");
    expect(screen.getByTestId("stack").querySelectorAll(".chip").length).toBe(3);
  });
});
