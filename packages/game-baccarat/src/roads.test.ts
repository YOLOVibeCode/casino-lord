import { describe, expect, it } from "vitest";
import { buildRoads, renderBigRoad, renderDerivedRoad } from "./roads/index.js";
import { DEFAULT_BACCARAT_RULES } from "./rules.js";
import { parseOutcomeToken } from "./quick-entry.js";
import type { RoadHand } from "./types.js";

function handsFromTokens(tokens: string): RoadHand[] {
  return tokens.split(/\s+/).filter(Boolean).map(parseOutcomeToken);
}

function gridSnapshot(render: string[]): string {
  return render.join("\n");
}

describe("roads golden grids", () => {
  it("BBBBBBBBB produces dragon tail on big road", () => {
    const roads = buildRoads(handsFromTokens("B B B B B B B B B"), DEFAULT_BACCARAT_RULES);
    const big = renderBigRoad(roads.bigRoad);
    expect(big.some((line) => line.includes("B"))).toBe(true);
    expect(roads.bigRoad.cols).toBeGreaterThan(1);
    expect(big[5]).toContain("B B B");
  });

  it("BPBPBPBP ping-pong creates many columns", () => {
    const roads = buildRoads(handsFromTokens("B P B P B P B P"), DEFAULT_BACCARAT_RULES);
    expect(roads.bigRoad.cols).toBe(8);
  });

  it("TTBPP handles leading ties with provisional cell", () => {
    const roads = buildRoads(handsFromTokens("T T B P P"), DEFAULT_BACCARAT_RULES);
    const big = renderBigRoad(roads.bigRoad);
    expect(big[0]?.startsWith("/")).toBe(true);
  });

  it("BBTBP shows tie slash with count on prior result", () => {
    const roads = buildRoads(handsFromTokens("B B T B P"), DEFAULT_BACCARAT_RULES);
    const big = renderBigRoad(roads.bigRoad);
    const hasTieSlash = big.some((line) => line.includes("B/"));
    expect(hasTieSlash).toBe(true);
  });

  it("derived roads all red on alternating-column depth", () => {
    const roads = buildRoads(handsFromTokens("B P B P B P B P B"), DEFAULT_BACCARAT_RULES);
    const beb = renderDerivedRoad(roads.bigEyeBoy).join("\n");
    const marks = beb.replace(/[^RB]/g, "");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks).toMatch(/^R+$/);
  });

  it("matches committed golden snapshot for BBBBBBBBB", () => {
    const roads = buildRoads(handsFromTokens("B B B B B B B B B"), DEFAULT_BACCARAT_RULES);
    expect(gridSnapshot(renderBigRoad(roads.bigRoad))).toMatchInlineSnapshot(`
      "B . . .
      B . . .
      B . . .
      B . . .
      B . . .
      B B B B"
    `);
  });

  it("matches committed golden snapshot for BPBPBPBP", () => {
    const roads = buildRoads(handsFromTokens("B P B P B P B P"), DEFAULT_BACCARAT_RULES);
    expect(gridSnapshot(renderBigRoad(roads.bigRoad))).toMatchInlineSnapshot(`
      "B P B P B P B P
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . ."
    `);
  });

  it("matches committed golden snapshot for TTBPP", () => {
    const roads = buildRoads(handsFromTokens("T T B P P"), DEFAULT_BACCARAT_RULES);
    expect(gridSnapshot(renderBigRoad(roads.bigRoad))).toMatchInlineSnapshot(`
      "/2 B P
      .  . P
      .  . .
      .  . .
      .  . .
      .  . ."
    `);
  });

  it("matches committed golden snapshot for BBTBP", () => {
    const roads = buildRoads(handsFromTokens("B B T B P"), DEFAULT_BACCARAT_RULES);
    expect(gridSnapshot(renderBigRoad(roads.bigRoad))).toMatchInlineSnapshot(`
      "B  P
      B/ .
      B  .
      .  .
      .  .
      .  ."
    `);
  });
});

describe("prediction cells", () => {
  it("appends prediction columns when enabled", () => {
    const rules = { ...DEFAULT_BACCARAT_RULES, predictionCells: true };
    const roads = buildRoads(handsFromTokens("B P B P B"), rules);
    expect(roads.bigEyePredictions?.cols).toBeGreaterThan(roads.bigEyeBoy.cols);
  });
});
