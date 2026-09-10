import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const manifestPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/manifest.webmanifest",
);

type WebManifest = {
  name: string;
  display: string;
  start_url: string;
  theme_color: string;
  icons: Array<{ sizes: string }>;
};

describe("manifest.webmanifest", () => {
  it("has required PWA fields", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as WebManifest;

    expect(manifest.name).toBe("Casino Lord");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toBeTruthy();

    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });
});
