/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { useRef } from "preact/hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDialogA11y } from "./use-dialog-a11y.js";

function TestDialog({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { dialogProps } = useDialogA11y({
    panelRef,
    onClose,
    titleId: "test-dialog-title",
  });

  return (
    <div ref={panelRef} {...dialogProps} data-testid="dialog-panel">
      <h2 id="test-dialog-title">Test dialog</h2>
      <button type="button">First action</button>
    </div>
  );
}

describe("useDialogA11y", () => {
  afterEach(() => cleanup());

  it("sets dialog ARIA attributes", () => {
    render(<TestDialog onClose={() => undefined} />);
    const panel = screen.getByTestId("dialog-panel");
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(panel.getAttribute("aria-labelledby")).toBe("test-dialog-title");
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<TestDialog onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the first focusable element on mount", () => {
    render(<TestDialog onClose={() => undefined} />);
    expect(document.activeElement?.textContent).toBe("First action");
  });
});
