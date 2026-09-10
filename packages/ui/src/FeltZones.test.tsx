/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeltZones } from "./FeltZones.js";
import { PlayerBettingContext } from "./player-betting-context.js";

const CONTEXT = {
  selectedDenomination: 25,
  showOthersBets: true,
  playerColor: "#f00",
  bettingDisabled: false,
  getOwnStake: (id: string) => (id === "banker" ? 100 : 0),
  getTableStake: (id: string) => (id === "banker" ? 250 : 0),
  settlementFlash: null as const,
  settlementByZone: {} as Record<string, "win" | "lose">,
  onZoneTap: vi.fn(),
  onZoneLongPress: vi.fn(),
};

function renderZones(onTap = vi.fn(), onLongPress = vi.fn()) {
  return render(
    <PlayerBettingContext.Provider value={CONTEXT}>
      <FeltZones
        zones={[
          { id: "banker", label: "BANKER", sublabel: "1:1", color: "#e5322d", target: "banker" },
        ]}
        onTap={onTap}
        onLongPress={onLongPress}
      />
    </PlayerBettingContext.Provider>,
  );
}

describe("FeltZones", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("fires onTap on short click", () => {
    const onTap = vi.fn();
    renderZones(onTap);
    const zone = screen.getByTestId("felt-zone-banker");
    fireEvent.mouseDown(zone);
    fireEvent.mouseUp(zone);
    expect(onTap).toHaveBeenCalled();
  });

  it("fires onLongPress after 500ms", () => {
    const onLongPress = vi.fn();
    renderZones(vi.fn(), onLongPress);
    const zone = screen.getByTestId("felt-zone-banker");
    fireEvent.mouseDown(zone);
    vi.advanceTimersByTime(500);
    fireEvent.mouseUp(zone);
    expect(onLongPress).toHaveBeenCalled();
  });

  it("shows own and table stakes", () => {
    renderZones();
    expect(screen.getByTestId("felt-zone-stake-banker").textContent).toContain("100");
    expect(screen.getByTestId("felt-zone-table-banker").textContent).toContain("250");
  });

  it("marks zones disabled when bettingDisabled is true", () => {
    render(
      <PlayerBettingContext.Provider value={{ ...CONTEXT, bettingDisabled: true }}>
        <FeltZones
          zones={[
            { id: "banker", label: "BANKER", sublabel: "1:1", color: "#e5322d", target: "banker" },
          ]}
          onTap={vi.fn()}
          onLongPress={vi.fn()}
        />
      </PlayerBettingContext.Provider>,
    );
    expect(screen.getByTestId("felt-zone-banker").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByTestId("felt-zones").className).toContain("felt-zones--disabled");
  });

  it("shows you label on own stake when disabled", () => {
    render(
      <PlayerBettingContext.Provider value={{ ...CONTEXT, bettingDisabled: true }}>
        <FeltZones
          zones={[
            { id: "banker", label: "BANKER", sublabel: "1:1", color: "#e5322d", target: "banker" },
          ]}
          onTap={vi.fn()}
          onLongPress={vi.fn()}
        />
      </PlayerBettingContext.Provider>,
    );
    expect(screen.getByTestId("felt-zone-you-banker").textContent).toBe("you");
  });

  it("shows WIN badge on winning zone", () => {
    render(
      <PlayerBettingContext.Provider value={{ ...CONTEXT, settlementByZone: { banker: "win" } }}>
        <FeltZones
          zones={[
            { id: "banker", label: "BANKER", sublabel: "1:1", color: "#e5322d", target: "banker" },
          ]}
          onTap={vi.fn()}
          onLongPress={vi.fn()}
        />
      </PlayerBettingContext.Provider>,
    );
    expect(screen.getByTestId("felt-zone-badge-banker").textContent).toBe("WIN");
  });
});
