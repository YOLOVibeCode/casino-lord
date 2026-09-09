import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BETTING_IMPORT = /\b(bets|PlacedBet|settle|betting)\b/;

function virtualFiles(): string[] {
  const root = join(import.meta.dirname, "../../..");
  const syncVirtual = join(root, "apps/sync/src/tables/virtual-dealer.ts");
  const gameDirs = readdirSync(join(root, "packages")).filter((d) => d.startsWith("game-"));
  const gameVirtuals = gameDirs.map((d) => join(root, "packages", d, "src/virtual.ts"));
  return [
    syncVirtual,
    ...gameVirtuals.filter((f) => {
      try {
        readFileSync(f);
        return true;
      } catch {
        return false;
      }
    }),
  ];
}

describe("virtual isolation from betting", () => {
  it("virtual-dealer and game virtual.ts files do not import betting modules", () => {
    for (const file of virtualFiles()) {
      const source = readFileSync(file, "utf8");
      const importLines = source
        .split("\n")
        .filter((line) => line.trimStart().startsWith("import "));
      for (const line of importLines) {
        expect(line).not.toMatch(BETTING_IMPORT);
      }
    }
  });
});
