import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildRoads, renderBigRoad } from "./roads/index.js";
import { DEFAULT_BACCARAT_RULES } from "./rules.js";
import { handsToRoadHands, importText } from "./serialize.js";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

describe("60-hand shoe fixture", () => {
  it("loads and builds roads for 60 hands", () => {
    const text = readFileSync(join(fixtureDir, "shoe-60.txt"), "utf8");
    const result = importText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hands).toHaveLength(60);

    const roads = buildRoads(handsToRoadHands(result.hands), DEFAULT_BACCARAT_RULES);
    expect(roads.beadPlate.cols).toBeGreaterThan(0);
    expect(roads.bigRoad.cols).toBeGreaterThan(0);
    expect(renderBigRoad(roads.bigRoad).length).toBe(6);
  });
});
