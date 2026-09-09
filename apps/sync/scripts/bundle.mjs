import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = resolve(packageRoot, process.env.BUNDLE_OUTDIR ?? "dist");
const outfile = resolve(outdir, "main.js");

mkdirSync(outdir, { recursive: true });

const externalPrefixes = ["@fastify/", "preact/"];

await esbuild.build({
  absWorkingDir: packageRoot,
  entryPoints: ["src/main.ts"],
  outfile,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  loader: {
    ".css": "empty",
  },
  banner: {
    js: `import { createRequire } from "module";\nconst require = createRequire(import.meta.url);`,
  },
  external: ["fastify", "socket.io", "better-sqlite3", "zod", "pino", "preact"],
  plugins: [
    {
      name: "external-scoped",
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          if (args.path.startsWith("@fastify/")) {
            return { path: args.path, external: true };
          }
          if (args.path.startsWith("preact/")) {
            return { path: args.path, external: true };
          }
          return null;
        });
      },
    },
  ],
});

const bundled = readFileSync(outfile, "utf8");
const stripped = bundled
  .split("\n")
  .filter((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("//")) {
      return true;
    }
    return !trimmed.includes(".ts") && !trimmed.includes("../../packages");
  })
  .join("\n");
writeFileSync(outfile, stripped);

console.log(`bundled ${outfile}`);
