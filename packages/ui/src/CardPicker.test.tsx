/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardPicker, type CardPickerProps } from "./CardPicker.js";

const valueOf = (rank: string): number =>
  rank === "10" || rank === "J" || rank === "Q" || rank === "K" ? 0 : Number(rank) || 1;

function renderPicker(
  overrides: Partial<Omit<CardPickerProps, "onCommit" | "onRemove" | "onClose">> = {},
) {
  const onCommit = vi.fn();
  const onRemove = vi.fn();
  const onClose = vi.fn();
  render(
    <CardPicker
      open
      title="Player · Card 1"
      expressMode={false}
      suitRequired={false}
      valueOf={valueOf}
      onCommit={onCommit}
      onRemove={onRemove}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onCommit, onRemove, onClose };
}

describe("CardPicker", () => {
  afterEach(() => cleanup());

  it("commits in three-tap mode (rank → suit → ✓)", () => {
    const { onCommit } = renderPicker({ expressMode: false });
    fireEvent.click(screen.getByTestId("rank-7"));
    fireEvent.click(screen.getByTestId("suit-H"));
    fireEvent.click(screen.getByTestId("card-picker-commit"));
    expect(onCommit).toHaveBeenCalledWith({ rank: "7", suit: "H" });
  });

  it("commits instantly in express mode when suit is sticky", () => {
    const { onCommit } = renderPicker({
      expressMode: true,
      initialCard: { rank: "A", suit: "S" },
    });
    fireEvent.click(screen.getByTestId("rank-K"));
    expect(onCommit).toHaveBeenCalledWith({ rank: "K", suit: "S" });
  });

  it("commits rank alone with suit null when suit not required in express mode", () => {
    const { onCommit } = renderPicker({ expressMode: true, suitRequired: false });
    fireEvent.click(screen.getByTestId("rank-7"));
    expect(onCommit).toHaveBeenCalledWith({ rank: "7", suit: null });
  });

  it("requires suit when suitRequired is true in three-tap mode", () => {
    const { onCommit } = renderPicker({ expressMode: false, suitRequired: true });
    fireEvent.click(screen.getByTestId("rank-7"));
    const commitBtn = screen.getByTestId("card-picker-commit") as HTMLButtonElement;
    expect(commitBtn.disabled).toBe(true);
    fireEvent.click(screen.getByTestId("suit-D"));
    fireEvent.click(commitBtn);
    expect(onCommit).toHaveBeenCalledWith({ rank: "7", suit: "D" });
  });

  it("supports keyboard rank, suit, and Enter", () => {
    const { onCommit } = renderPicker({ expressMode: false });
    fireEvent.keyDown(document, { key: "7" });
    fireEvent.keyDown(document, { key: "h" });
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith({ rank: "7", suit: "H" });
  });

  it("maps 0 key to rank 10", () => {
    const { onCommit } = renderPicker({ expressMode: false });
    fireEvent.keyDown(document, { key: "0" });
    fireEvent.keyDown(document, { key: "s" });
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith({ rank: "10", suit: "S" });
  });

  it("calls onRemove on Backspace", () => {
    const { onRemove } = renderPicker();
    fireEvent.keyDown(document, { key: "Backspace" });
    expect(onRemove).toHaveBeenCalled();
  });

  it("calls onClose on Escape", () => {
    const { onClose } = renderPicker();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows duplicate warning without blocking commit", () => {
    const { onCommit } = renderPicker({
      duplicateWarning: "Duplicate card 7H in P1 and P2",
      expressMode: true,
    });
    fireEvent.click(screen.getByTestId("rank-7"));
    expect(screen.getByTestId("card-picker-warning")).toBeTruthy();
    expect(onCommit).toHaveBeenCalled();
  });

  it("exposes accessible names on rank buttons", () => {
    renderPicker();
    expect(screen.getByTestId("rank-K").getAttribute("aria-label")).toBe("King, value 0");
    expect(screen.getByTestId("rank-7").getAttribute("aria-label")).toBe("7, value 7");
  });

  it("exposes accessible names on suit buttons", () => {
    renderPicker();
    expect(screen.getByTestId("suit-S").getAttribute("aria-label")).toBe("Spades");
    expect(screen.getByTestId("suit-H").getAttribute("aria-label")).toBe("Hearts");
  });

  it("blocks commit when blocked prop is set", () => {
    const { onCommit } = renderPicker({
      blocked: "Shoe limit reached (416 cards)",
      expressMode: true,
    });
    fireEvent.click(screen.getByTestId("rank-7"));
    expect(screen.getByTestId("card-picker-blocked")).toBeTruthy();
    expect(onCommit).not.toHaveBeenCalled();
    const commitBtn = screen.getByTestId("card-picker-commit") as HTMLButtonElement;
    expect(commitBtn.disabled).toBe(true);
  });
});
