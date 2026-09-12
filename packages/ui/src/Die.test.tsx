/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { Die } from "./Die.js";

describe("Die", () => {
  afterEach(() => cleanup());

  it("exposes the face in the accessible name", () => {
    render(<Die face={5} testId="die-5" />);
    expect(screen.getByTestId("die-5").getAttribute("aria-label")).toBe("Die showing 5");
    expect(screen.getByTestId("die-5").querySelectorAll("circle").length).toBe(5);
  });

  it("sizes via class", () => {
    render(<Die face={1} size="lg" testId="die-1" />);
    expect(screen.getByTestId("die-1").className).toContain("die--lg");
  });
});
