import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function displayScale(width: number, height: number): number {
  return Math.min(width / 1920, height / 1080);
}

describe("display scale", () => {
  it("defines --display-scale on the display shell root", () => {
    const css = readFileSync(resolve("apps/web/src/shells/display-shell.css"), "utf8");
    expect(css).toContain("--display-scale: min(100vw / 1920, 100vh / 1080)");
  });

  it("preserves proportional scale between 1080p and 4K viewports", () => {
    const scale1080 = displayScale(1920, 1080);
    const scale4k = displayScale(3840, 2160);
    expect(scale1080 / 1920).toBeCloseTo(scale4k / 3840, 10);
    expect(scale1080 / 1080).toBeCloseTo(scale4k / 2160, 10);
  });
});
