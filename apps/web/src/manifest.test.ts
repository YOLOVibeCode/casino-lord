import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../public");
const manifestPath = join(publicDir, "manifest.webmanifest");

type WebManifestIcon = {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
};

type WebManifest = {
  name: string;
  display: string;
  start_url: string;
  theme_color: string;
  icons: WebManifestIcon[];
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

  it("includes PNG icons for add-to-home-screen", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as WebManifest;
    const pngIcons = manifest.icons.filter((icon) => icon.type === "image/png");

    expect(pngIcons.some((icon) => icon.sizes === "192x192" && icon.purpose === "any")).toBe(true);
    expect(pngIcons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any")).toBe(true);
    expect(pngIcons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable")).toBe(
      true,
    );

    for (const icon of pngIcons) {
      const filePath = join(publicDir, icon.src.replace(/^\//, ""));
      expect(() => readFileSync(filePath)).not.toThrow();
    }
  });
});
