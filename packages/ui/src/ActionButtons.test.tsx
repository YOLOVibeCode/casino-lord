/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionButtons } from "./ActionButtons.js";

describe("ActionButtons", () => {
  afterEach(() => cleanup());

  it("renders countdown ring and fires action", () => {
    const onAction = vi.fn();
    render(
      <ActionButtons
        actions={[{ id: "hit", label: "HIT", enabled: true, action: { kind: "hit" } }]}
        countdownSec={15}
        onAction={onAction}
      />,
    );
    expect(screen.getByTestId("action-countdown-ring")).toBeTruthy();
    fireEvent.click(screen.getByTestId("action-btn-hit"));
    expect(onAction).toHaveBeenCalledWith({ kind: "hit" });
  });

  it("disables button when not enabled", () => {
    render(
      <ActionButtons
        actions={[{ id: "stand", label: "STAND", enabled: false, action: { kind: "stand" } }]}
        countdownSec={null}
        onAction={vi.fn()}
      />,
    );
    expect((screen.getByTestId("action-btn-stand") as HTMLButtonElement).disabled).toBe(true);
  });
});
