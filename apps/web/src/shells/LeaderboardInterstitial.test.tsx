/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeaderboardInterstitial } from "./LeaderboardInterstitial.js";

const entries = [
  { playerId: "p1", name: "Ana", bankroll: 500, net: 50 },
  { playerId: "p2", name: "Ben", bankroll: 400, net: -20 },
];

describe("LeaderboardInterstitial", () => {
  afterEach(() => cleanup());

  it("shows disclaimer and hides Continue when not persistent", () => {
    render(<LeaderboardInterstitial byBankroll={entries} byNet={entries} onDismiss={() => {}} />);

    expect(screen.getByText("Play chips — no cash value")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });

  it("shows Continue when persistent and dismisses on click", () => {
    const onDismiss = vi.fn();
    render(
      <LeaderboardInterstitial
        byBankroll={entries}
        byNet={entries}
        onDismiss={onDismiss}
        persistent
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
