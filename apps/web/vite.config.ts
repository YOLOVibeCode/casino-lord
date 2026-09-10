import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function resolveBuildHash(): string {
  const railwaySha = process.env.RAILWAY_GIT_COMMIT_SHA?.trim();
  if (railwaySha) return railwaySha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  plugins: [preact()],
  resolve: {
    dedupe: ["preact"],
  },
  define: {
    __BUILD_HASH__: JSON.stringify(resolveBuildHash()),
  },
});
