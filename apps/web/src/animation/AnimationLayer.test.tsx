/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { AnimationLayer, type ActiveSegment } from "./AnimationLayer.js";

function segment(
  style: ActiveSegment["style"],
  overrides: Partial<ActiveSegment> = {},
): ActiveSegment {
  return {
    id: `${style}-1`,
    style,
    color: "#D4AF37",
    intensity: 2,
    durationMs: 500,
    phase: "main",
    ...overrides,
  };
}

describe("AnimationLayer", () => {
  afterEach(() => cleanup());

  it("renders flash with style and phase attrs", () => {
    render(<AnimationLayer segments={[segment("flash")]} />);
    expect(screen.getByTestId("animation-layer")).toBeTruthy();
    expect(document.querySelector('[data-style="flash"][data-phase="main"]')).toBeTruthy();
  });

  it("renders burst canvas", () => {
    render(<AnimationLayer segments={[segment("burst", { anchor: { x: 10, y: 10 } })]} />);
    expect(document.querySelector('[data-style="burst"]')).toBeTruthy();
  });

  it("renders sweep banner and particles", () => {
    render(
      <AnimationLayer
        segments={[
          segment("sweep"),
          segment("banner", { text: "PLAYER 9" }),
          segment("particles", { anchor: { x: 1, y: 1 } }),
        ]}
      />,
    );
    expect(document.querySelector('[data-style="sweep"]')).toBeTruthy();
    expect(document.querySelector('[data-style="banner"]')).toBeTruthy();
    expect(document.querySelector('[data-style="particles"]')).toBeTruthy();
    expect(screen.getByText("PLAYER 9")).toBeTruthy();
  });

  it("renders trail and dragon svg paths", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 20, y: 10 },
    ];
    render(<AnimationLayer segments={[segment("trail", { path }), segment("dragon", { path })]} />);
    expect(document.querySelector('[data-style="trail"]')).toBeTruthy();
    expect(document.querySelector('[data-style="dragon"]')).toBeTruthy();
  });

  it("renders shake marker and omits spin/chips/none", () => {
    render(
      <AnimationLayer
        segments={[segment("shake"), segment("spin"), segment("chips"), segment("none")]}
      />,
    );
    expect(document.querySelector('[data-style="shake"]')).toBeTruthy();
    expect(document.querySelector('[data-style="spin"]')).toBeNull();
    expect(document.querySelector('[data-style="chips"]')).toBeNull();
    expect(document.querySelector('[data-style="none"]')).toBeNull();
  });
});
