import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(repoRoot, "apps/web/dist");
const versionPath = join(distDir, "version.json");

let commit = "dev";
try {
  commit = execSync("git rev-parse --short HEAD", {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
} catch {
  // Non-git environments fall back to dev.
}

mkdirSync(distDir, { recursive: true });

const payload = {
  version: commit,
  commit,
  builtAt: new Date().toISOString(),
};

writeFileSync(versionPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
