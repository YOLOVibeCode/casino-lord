/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BLACKJACK_RULES } from "../rules.js";
import type { Card } from "../types.js";
import { ResultDetailView } from "./ResultDetailView.js";

function c(rank: Card["rank"], suit: Card["suit"] = "S"): Card {
  return { rank, suit };
}

afterEach(() => cleanup());

describe("ResultDetailView", () => {
  it("shows dealer error flag when recorded despite error", () => {
    render(
      <ResultDetailView
        rules={DEFAULT_BLACKJACK_RULES}
        result={{
          dealer: { cards: [c("10"), c("7"), c("2")], total: 19, bust: false, blackjack: false },
          seats: {
            1: [
              {
                cards: [c("10"), c("9")],
                doubled: false,
                fromSplit: false,
                surrendered: false,
                outcome: "win",
              },
            ],
          },
          depth: "full",
          dealerError: true,
        }}
      />,
    );

    expect(screen.getByTestId("result-dealer-error")).toBeTruthy();
    expect(screen.getByTestId("result-seat-1")).toBeTruthy();
  });

  it("shows quick entry note for quick depth", () => {
    render(
      <ResultDetailView
        rules={DEFAULT_BLACKJACK_RULES}
        result={{
          dealer: { cards: [], total: 20, bust: false, blackjack: false },
          seats: {},
          depth: "quick",
          dealerError: false,
        }}
      />,
    );

    expect(screen.getByTestId("quick-entry-note")).toBeTruthy();
  });
});
