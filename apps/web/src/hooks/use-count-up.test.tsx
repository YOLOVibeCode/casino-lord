/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCountUp } from "./use-count-up.js";

function Probe({ value }: { value: number }) {
  const display = useCountUp(value);
  return <span data-testid="display">{display}</span>;
}

describe("useCountUp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the target value immediately when prefers-reduced-motion is set", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

    render(<Probe value={500} />);
    expect(screen.getByTestId("display").textContent).toBe("500");
  });
});
