/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { BettingStrip } from "./BettingStrip.js";

describe("BettingStrip", () => {
  it("shows ~50% bar width at half time", () => {
    render(
      <BettingStrip
        round={{
          id: "r1",
          status: "open",
          openedAt: "2026-01-01T00:00:00.000Z",
          closesAt: "2026-01-01T00:01:00.000Z",
        }}
        betsView={{ summaries: [] }}
        countdownSec={30}
        settlementTicker=""
        betTimerSec={60}
      />,
    );

    const fill = screen.getByTestId("betting-strip").querySelector(".betting-strip__bar-fill");
    expect(fill).toBeTruthy();
    const width = (fill as HTMLElement).style.width;
    expect(width).toBe("50%");
  });
});
