/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BetSlip } from "./BetSlip.js";

describe("BetSlip", () => {
  afterEach(() => cleanup());

  it("shows totals and PLACE", () => {
    const onPlace = vi.fn();
    render(
      <BetSlip
        entries={[
          { id: "p1", label: "Banker", amount: 100, pending: true },
          { id: "b1", label: "Player", amount: 50, pending: false },
        ]}
        total={150}
        locked={false}
        canPlace
        onRemove={vi.fn()}
        onPlace={onPlace}
      />,
    );
    expect(screen.getByTestId("bet-slip-total").textContent).toContain("150");
    fireEvent.click(screen.getByTestId("bet-slip-place"));
    expect(onPlace).toHaveBeenCalled();
  });

  it("shows payout detail on rows and stake-only compact total", () => {
    render(
      <BetSlip
        entries={[
          {
            id: "p1",
            label: "BANKER",
            amount: 5,
            pending: true,
            detail: "Stake 5 · pays +4",
          },
        ]}
        total={5}
        pendingStake={5}
        locked={false}
        canPlace
        placeLabel="PLACE 5 · 495 left"
        onRemove={vi.fn()}
        onPlace={vi.fn()}
      />,
    );
    expect(screen.getByTestId("bet-slip-compact-total").textContent).toBe("Stake 5");
    fireEvent.click(screen.getByTestId("bet-slip-compact"));
    expect(screen.getByTestId("bet-slip-row-p1").textContent).toContain("Stake 5 · pays +4");
    expect(screen.getByTestId("bet-slip-place").textContent).toBe("PLACE 5 · 495 left");
  });

  it("shows locked message when bets closed", () => {
    render(
      <BetSlip
        entries={[]}
        total={0}
        locked
        canPlace={false}
        onRemove={vi.fn()}
        onPlace={vi.fn()}
      />,
    );
    expect(screen.getByTestId("bet-slip-locked").textContent).toContain("Bets closed");
  });
});
