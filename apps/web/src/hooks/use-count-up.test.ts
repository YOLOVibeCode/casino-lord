/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import { useCountUp } from "./use-count-up.js";

describe("useCountUp", () => {
  it("returns the target value immediately when reduced motion is preferred", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

    const { result, rerender } = renderHook(({ value }) => useCountUp(value, 400), {
      initialProps: { value: 10 },
    });

    expect(result.current).toBe(10);
    rerender({ value: 250 });
    expect(result.current).toBe(250);
  });
});
