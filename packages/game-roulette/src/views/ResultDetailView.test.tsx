/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_ROULETTE_RULES } from "../rules.js";
import { ResultDetailView } from "./ResultDetailView.js";

describe("ResultDetailView", () => {
  afterEach(() => cleanup());

  it("shows pocket properties for a numbered result", () => {
    render(<ResultDetailView result={{ pocket: 17 }} rules={DEFAULT_ROULETTE_RULES} />);
    expect(screen.getByTestId("result-detail").textContent).toContain("17 BLACK");
    expect(screen.getByTestId("result-parity").textContent).toBe("ODD");
    expect(screen.getByTestId("result-neighbours")).toBeTruthy();
  });

  it("shows no spin for void result", () => {
    render(<ResultDetailView result={{ pocket: null }} rules={DEFAULT_ROULETTE_RULES} />);
    expect(screen.getByTestId("result-detail").textContent).toContain("NO SPIN");
  });
});
