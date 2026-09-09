/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutcomeChips } from "./OutcomeChips.js";

const CHIPS = [
  { id: "P", label: "P", color: "#2563eb", ariaLabel: "Player win" },
  { id: "B", label: "B", color: "#e5322d", ariaLabel: "Banker win" },
  { id: "T", label: "T", color: "#16a34a", ariaLabel: "Tie" },
];

describe("OutcomeChips", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("fires onTap on short click", () => {
    const onTap = vi.fn();
    const onLongPress = vi.fn();
    render(<OutcomeChips chips={CHIPS} onTap={onTap} onLongPress={onLongPress} />);
    const chip = screen.getByTestId("outcome-chip-P");
    fireEvent.mouseDown(chip);
    fireEvent.mouseUp(chip);
    expect(onTap).toHaveBeenCalledWith("P");
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("fires onLongPress after 500ms hold", () => {
    const onTap = vi.fn();
    const onLongPress = vi.fn();
    render(<OutcomeChips chips={CHIPS} onTap={onTap} onLongPress={onLongPress} />);
    const chip = screen.getByTestId("outcome-chip-B");
    fireEvent.mouseDown(chip);
    vi.advanceTimersByTime(500);
    fireEvent.mouseUp(chip);
    expect(onLongPress).toHaveBeenCalledWith("B");
    expect(onTap).not.toHaveBeenCalled();
  });

  it("fires onLongPress via Shift+Enter keyboard equivalent", () => {
    const onTap = vi.fn();
    const onLongPress = vi.fn();
    render(<OutcomeChips chips={CHIPS} onTap={onTap} onLongPress={onLongPress} />);
    const chip = screen.getByTestId("outcome-chip-T");
    fireEvent.keyDown(chip, { key: " ", shiftKey: true });
    expect(onLongPress).toHaveBeenCalledWith("T");
    expect(onTap).not.toHaveBeenCalled();
  });
});
