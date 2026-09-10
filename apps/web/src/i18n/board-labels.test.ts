import { describe, expect, it } from "vitest";
import { formatBoardLabel } from "./board-labels.js";

export const KNOWN_DISPLAY_STAT_LABELS = [
  "Player",
  "Banker",
  "Tie",
  "Player %",
  "Banker %",
  "Player pairs",
  "Banker pairs",
  "Naturals",
  "Current streak",
  "Longest streak",
  "Hands this shoe",
  "Est. hands remaining",
  "Spins this session",
  "Last number",
  "Red %",
  "Black %",
  "Green %",
  "Odd %",
  "Even %",
  "Low %",
  "High %",
  "Dozens %",
  "Columns %",
  "Hot 5",
  "Cold 5",
  "Current colour streak",
  "Longest colour streak",
  "Spins since zero",
  "Repeats this session",
  "Sector hits",
  "Shooter rolls",
  "Points made",
  "Distinct points",
  "Rolls since point",
  "Hard ways",
  "Small progress",
  "Tall progress",
  "Table rolls",
  "Shooters",
  "Longest hand",
  "Most points/hand",
  "Sevens",
  "Distribution",
  "Avg rolls/shooter",
  "Rounds this shoe",
  "Dealer bust %",
  "Dealer blackjack",
  "Player blackjack",
  "Pushes",
  "Dealer totals",
  "Shoe penetration",
  "Cards seen",
  "5+ card 21s",
  "Seat 1",
  "Seat 2",
  "Seat 3",
  "Seat 4",
  "Seat 5",
  "Seat 6",
  "Seat 7",
] as const;

describe("formatBoardLabel", () => {
  it("returns English for EN", () => {
    expect(formatBoardLabel("Player", "EN")).toBe("Player");
    expect(formatBoardLabel("Bead Plate", "EN")).toBe("Bead Plate");
  });

  it("returns Chinese for ZH", () => {
    expect(formatBoardLabel("Player", "ZH")).toBe("闲");
    expect(formatBoardLabel("Banker", "ZH")).toBe("庄");
  });

  it("returns dual labels for EN+ZH", () => {
    expect(formatBoardLabel("Player", "EN+ZH")).toBe("Player / 闲");
    expect(formatBoardLabel("Bead Plate", "EN+ZH")).toBe("Bead Plate / 珠盘");
    expect(formatBoardLabel("Red", "EN+ZH")).toBe("Red / 红");
  });

  it.each(KNOWN_DISPLAY_STAT_LABELS)("translates %s for ZH", (key) => {
    expect(formatBoardLabel(key, "ZH")).not.toBe(key);
  });

  it.each(KNOWN_DISPLAY_STAT_LABELS)("translates %s for EN+ZH", (key) => {
    expect(formatBoardLabel(key, "EN+ZH")).toContain(" / ");
  });
});
