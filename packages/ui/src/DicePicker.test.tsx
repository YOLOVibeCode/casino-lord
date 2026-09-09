/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DicePicker } from "./DicePicker.js";

function renderPicker(
  overrides: Partial<{
    dieA: 1 | 2 | 3 | 4 | 5 | 6 | null;
    dieB: 1 | 2 | 3 | 4 | 5 | 6 | null;
    expressMode: boolean;
    confirmRequired: boolean;
  }> = {},
) {
  const onDieA = vi.fn();
  const onDieB = vi.fn();
  const onCommit = vi.fn();
  const onClear = vi.fn();
  render(
    <DicePicker
      dieA={overrides.dieA ?? null}
      dieB={overrides.dieB ?? null}
      expressMode={overrides.expressMode ?? false}
      confirmRequired={overrides.confirmRequired ?? false}
      onDieA={onDieA}
      onDieB={onDieB}
      onCommit={onCommit}
      onClear={onClear}
    />,
  );
  return { onDieA, onDieB, onCommit, onClear };
}

describe("DicePicker", () => {
  afterEach(() => cleanup());

  it("selects die A then die B with confirm", () => {
    const { onDieA, onDieB, onCommit } = renderPicker({ expressMode: false });
    fireEvent.click(screen.getByTestId("die-a-4"));
    expect(onDieA).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByTestId("die-b-3"));
    expect(onDieB).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByTestId("dice-picker-commit"));
    expect(onCommit).toHaveBeenCalled();
  });

  it("express mode commits when both dice set via second tap", () => {
    const { onDieB, onCommit } = renderPicker({ dieA: 4, expressMode: true });
    fireEvent.click(screen.getByTestId("die-b-3"));
    expect(onDieB).toHaveBeenCalledWith(3);
    expect(onCommit).toHaveBeenCalled();
  });

  it("keyboard digits set faces and Enter commits", () => {
    const onDieA = vi.fn();
    const onDieB = vi.fn();
    const onCommit = vi.fn();
    const onClear = vi.fn();
    const { rerender } = render(
      <DicePicker
        dieA={null}
        dieB={null}
        expressMode={false}
        onDieA={onDieA}
        onDieB={onDieB}
        onCommit={onCommit}
        onClear={onClear}
      />,
    );
    const picker = screen.getByTestId("dice-picker");
    fireEvent.keyDown(picker, { key: "4" });
    expect(onDieA).toHaveBeenCalledWith(4);
    rerender(
      <DicePicker
        dieA={4}
        dieB={null}
        expressMode={false}
        onDieA={onDieA}
        onDieB={onDieB}
        onCommit={onCommit}
        onClear={onClear}
      />,
    );
    fireEvent.keyDown(picker, { key: "3" });
    expect(onDieB).toHaveBeenCalledWith(3);
    rerender(
      <DicePicker
        dieA={4}
        dieB={3}
        expressMode={false}
        onDieA={onDieA}
        onDieB={onDieB}
        onCommit={onCommit}
        onClear={onClear}
      />,
    );
    fireEvent.keyDown(picker, { key: "Enter" });
    expect(onCommit).toHaveBeenCalled();
  });

  it("backspace clears selection", () => {
    const { onClear } = renderPicker({ dieA: 4, dieB: 3 });
    fireEvent.keyDown(screen.getByTestId("dice-picker"), { key: "Backspace" });
    expect(onClear).toHaveBeenCalled();
  });
});
