import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function tvScale(width: number, height: number): number {
  return Math.min(width / 1920, height / 1080);
}

function tabletPortraitScale(width: number, height: number): number {
  return Math.min(width / 1024, height / 1366);
}

function tabletLandscapeScale(width: number, height: number): number {
  return Math.min(width / 1366, height / 1024);
}

describe("display scale", () => {
  it("defines TV and tablet --display-scale formulas", () => {
    const css = readFileSync(resolve("apps/web/src/shells/display-shell.css"), "utf8");
    expect(css).toContain("--display-scale: min(100vw / 1920, 100vh / 1080)");
    expect(css).toContain("--display-scale: min(100vw / 1024, 100vh / 1366)");
    expect(css).toContain("--display-scale: min(100vw / 1366, 100vh / 1024)");
  });

  it("preserves proportional scale between 1080p and 4K viewports", () => {
    const scale1080 = tvScale(1920, 1080);
    const scale4k = tvScale(3840, 2160);
    expect(scale1080 / 1920).toBeCloseTo(scale4k / 3840, 10);
    expect(scale1080 / 1080).toBeCloseTo(scale4k / 2160, 10);
  });

  it("uses a larger scale on iPad than the 16:9 TV formula", () => {
    expect(tabletLandscapeScale(1180, 820)).toBeGreaterThan(tvScale(1180, 820));
    expect(tabletPortraitScale(820, 1180)).toBeGreaterThan(tvScale(820, 1180));
  });
});
