/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChipTray } from "./ChipTray.js";

describe("ChipTray", () => {
  afterEach(() => cleanup());

  it("selects denomination on tap", () => {
    const onSelect = vi.fn();
    render(
      <ChipTray denominations={[5, 25, 100]} selected={5} onSelect={onSelect} onClear={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("chip-denom-25"));
    expect(onSelect).toHaveBeenCalledWith(25);
  });

  it("fires Clear", () => {
    const onClear = vi.fn();
    render(<ChipTray denominations={[5, 25]} selected={5} onSelect={vi.fn()} onClear={onClear} />);
    fireEvent.click(screen.getByTestId("chip-tray-clear"));
    expect(onClear).toHaveBeenCalled();
  });

  it("shows selected chip label", () => {
    render(<ChipTray denominations={[5, 25, 100]} selected={25} onSelect={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByTestId("chip-tray-selected").textContent).toBe("Selected chip: 25");
  });
});
