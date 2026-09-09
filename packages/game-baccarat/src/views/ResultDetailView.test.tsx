/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BACCARAT_RULES } from "../rules.js";
import { ResultDetailView } from "./ResultDetailView.js";

describe("ResultDetailView", () => {
  afterEach(() => cleanup());

  it("shows cards and totals for carded hand", () => {
    render(
      <ResultDetailView
        rules={DEFAULT_BACCARAT_RULES}
        result={{
          cards: {
            P1: { rank: "7", suit: "H" },
            P2: { rank: "K", suit: "S" },
            B1: { rank: "4", suit: "D" },
            B2: { rank: "5", suit: "C" },
          },
          outcome: "B",
          playerTotal: 7,
          bankerTotal: 9,
          playerPair: false,
          bankerPair: false,
          natural: true,
        }}
      />,
    );
    expect(screen.getByTestId("result-player-cards").textContent).toContain("7♥");
    expect(screen.getByTestId("result-banker-cards").textContent).toContain("4♦");
    expect(screen.getByText("NATURAL")).toBeTruthy();
  });

  it("shows quick entry note when no cards", () => {
    render(
      <ResultDetailView
        rules={DEFAULT_BACCARAT_RULES}
        result={{
          cards: null,
          outcome: "P",
          playerTotal: null,
          bankerTotal: null,
          playerPair: false,
          bankerPair: false,
          natural: false,
        }}
      />,
    );
    expect(screen.getByTestId("quick-entry-note").textContent).toBe("Quick entry — no cards");
  });
});
