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

  it("announces countdown with visually hidden text", () => {
    render(
      <ActionButtons
        actions={[{ id: "hit", label: "HIT", enabled: true, action: { kind: "hit" } }]}
        countdownSec={10}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText("10 s left")).toBeTruthy();
  });

  it("does not vibrate at countdown milestones when haptics disabled", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    const { rerender } = render(
      <ActionButtons
        actions={[{ id: "hit", label: "HIT", enabled: true, action: { kind: "hit" } }]}
        countdownSec={11}
        haptics={false}
        onAction={vi.fn()}
      />,
    );
    rerender(
      <ActionButtons
        actions={[{ id: "hit", label: "HIT", enabled: true, action: { kind: "hit" } }]}
        countdownSec={10}
        haptics={false}
        onAction={vi.fn()}
      />,
    );
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("vibrates at countdown milestones when haptics enabled", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    const { rerender } = render(
      <ActionButtons
        actions={[{ id: "hit", label: "HIT", enabled: true, action: { kind: "hit" } }]}
        countdownSec={11}
        haptics={true}
        onAction={vi.fn()}
      />,
    );
    rerender(
      <ActionButtons
        actions={[{ id: "hit", label: "HIT", enabled: true, action: { kind: "hit" } }]}
        countdownSec={10}
        haptics={true}
        onAction={vi.fn()}
      />,
    );
    expect(vibrate).toHaveBeenCalledWith(10);
  });
});
