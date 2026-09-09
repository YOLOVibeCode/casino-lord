/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BLACKJACK_RULES } from "../rules.js";
import type { Card } from "../types.js";
import { DisplayView } from "./DisplayView.js";
import { TABLE_META, stateWithLiveInput } from "./test-helpers.js";

const EMPTY_BETS = { round: null, summaries: [], openBets: [] };

function c(rank: Card["rank"], suit: Card["suit"] = "S"): Card {
  return { rank, suit };
}

afterEach(() => cleanup());

describe("DisplayView", () => {
  it("shows WIN for both seats when dealer busts in full depth", () => {
    const rules = { ...DEFAULT_BLACKJACK_RULES, entryDepth: "full" as const };
    const state = stateWithLiveInput(
      {
        dealer: [c("10"), c("6"), c("8")],
        seats: {
          1: [
            {
              cards: [c("10"), c("9")],
              doubled: false,
              fromSplit: false,
              surrendered: false,
              outcome: null,
            },
          ],
          2: [
            {
              cards: [c("9"), c("8")],
              doubled: false,
              fromSplit: false,
              surrendered: false,
              outcome: null,
            },
          ],
        },
      },
      rules,
    );

    render(
      <DisplayView
        state={state}
        rules={rules}
        table={TABLE_META}
        bets={EMPTY_BETS}
        layout={{ id: "classic", label: "Classic", aspect: "16:9" }}
      />,
    );

    expect(screen.getByTestId("seat-1-outcome-0").textContent).toBe("WIN");
    expect(screen.getByTestId("seat-2-outcome-0").textContent).toBe("WIN");
  });

  it("switches layout modifiers across four layouts", () => {
    const state = stateWithLiveInput({ dealer: [], seats: {} });
    for (const layoutId of ["classic", "dealer-focus", "stats-focus", "portrait"] as const) {
      const { unmount } = render(
        <DisplayView
          state={state}
          rules={DEFAULT_BLACKJACK_RULES}
          table={TABLE_META}
          bets={EMPTY_BETS}
          layout={{
            id: layoutId,
            label: layoutId,
            aspect: layoutId === "portrait" ? "9:16" : "16:9",
          }}
        />,
      );
      const root = screen.getByTestId("display-view");
      expect(root.getAttribute("data-layout")).toBe(layoutId);
      expect(root.className).toContain(`display-view--${layoutId}`);
      expect(screen.getByTestId("dealer-hand")).toBeTruthy();
      expect(screen.getByTestId("seat-1").getAttribute("data-seat")).toBe("1");
      unmount();
    }
  });
});
