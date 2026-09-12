/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { PlayingCard, playingCardLabel } from "./PlayingCard.js";

describe("PlayingCard", () => {
  afterEach(() => cleanup());

  it("labels a face card with rank and suit glyph", () => {
    render(<PlayingCard rank="7" suit="H" testId="card-7h" />);
    expect(screen.getByTestId("card-7h").getAttribute("aria-label")).toBe("7♥");
    expect(playingCardLabel("7", "H")).toBe("7♥");
  });

  it("uses a red face for hearts and diamonds", () => {
    const { container } = render(<PlayingCard rank="A" suit="D" />);
    expect(container.querySelector('text[fill="#c8102e"]')).toBeTruthy();
  });

  it("renders a face-down back", () => {
    render(<PlayingCard faceDown testId="hole" />);
    expect(screen.getByTestId("hole").getAttribute("aria-label")).toBe("Face-down card");
    expect(screen.getByTestId("hole").querySelector("#playing-card-lattice")).toBeTruthy();
  });

  it("renders an empty outline", () => {
    render(<PlayingCard empty testId="empty" />);
    expect(screen.getByTestId("empty").getAttribute("aria-label")).toBe("Empty card");
    expect(screen.getByTestId("empty").className).toContain("playing-card--empty");
  });

  it("sizes via class", () => {
    render(<PlayingCard rank="K" suit="S" size="lg" testId="king" />);
    expect(screen.getByTestId("king").className).toContain("playing-card--lg");
  });
});
