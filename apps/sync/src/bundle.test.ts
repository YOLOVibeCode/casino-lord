import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = join(packageRoot, "test-fixtures/static");
const bundleScript = join(packageRoot, "scripts/bundle.mjs");

const children: Array<ReturnType<typeof spawn>> = [];
const tempDirs: string[] = [];

afterEach(() => {
  for (const child of children.splice(0)) {
    child.kill("SIGTERM");
  }
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function bundleTo(outdir: string): string {
  execFileSync(process.execPath, [bundleScript], {
    cwd: packageRoot,
    env: { ...process.env, BUNDLE_OUTDIR: outdir },
    stdio: "pipe",
  });
  return join(outdir, "main.js");
}

function waitForListen(child: ReturnType<typeof spawn>, timeoutMs = 4000): Promise<number> {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      reject(new Error(`timeout waiting for Server listening; output:\n${output}`));
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/Server listening at http:\/\/(?:127\.0\.0\.1|0\.0\.0\.0):(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/Server listening at http:\/\/(?:127\.0\.0\.1|0\.0\.0\.0):(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`process exited ${code}; output:\n${output}`));
      }
    });
  });
}

describe("sync bundle", () => {
  it("starts bundled main.js and serves healthz and POST /tables", async () => {
    const startedAt = Date.now();
    const outdir = mkdtempSync(join(packageRoot, ".tmp-bundle-"));
    tempDirs.push(outdir);

    const mainJs = bundleTo(outdir);
    const bundleSource = readFileSync(mainJs, "utf8");
    expect(bundleSource).not.toMatch(/from\s+["'][^"']*\.ts["']/);
    expect(bundleSource).not.toMatch(/from\s+["'][^"']*\.\.\/\.\.\/packages/);

    const child = spawn(process.execPath, [mainJs], {
      env: {
        ...process.env,
        PORT: "0",
        PERSIST: "memory",
        STATIC_ROOT: fixtureRoot,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);

    const port = await waitForListen(child);
    const baseUrl = `http://127.0.0.1:${port}`;

    const health = await fetch(`${baseUrl}/healthz`);
    expect(health.status).toBe(200);

    const create = await fetch(`${baseUrl}/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: "baccarat",
        participation: { playerMode: "off", bank: "none", outcomeSource: "physical" },
      }),
    });
    expect(create.status).toBe(201);
    const body = (await create.json()) as { code: string };
    expect(body.code).toMatch(/^[A-Z2-9]{6}$/);

    expect(Date.now() - startedAt).toBeLessThan(5000);
  });
});
