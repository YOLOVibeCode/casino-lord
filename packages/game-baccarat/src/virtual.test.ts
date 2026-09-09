import { createSeededRng, hexToBytes } from "@casino-lord/core";
import { describe, expect, it } from "vitest";
import { DEFAULT_BACCARAT_RULES } from "./rules.js";
import { initialState } from "./state.js";
import {
  baccaratVirtualStep,
  buildShoe,
  shoePenetration,
  type VirtualShoeSession,
} from "./virtual.js";

const TEST_SEED = hexToBytes("010203040506070708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20");

describe("baccarat virtual shoe", () => {
  it("penetration matches spec formula", () => {
    expect(shoePenetration({ ...DEFAULT_BACCARAT_RULES, decks: 8 })).toBeCloseTo(1 - 14 / 416);
    expect(shoePenetration({ ...DEFAULT_BACCARAT_RULES, decks: 6 })).toBeCloseTo(1 - 14 / 312);
  });

  it("buildShoe is deterministic for a fixed seed", () => {
    const rngA = createSeededRng(TEST_SEED);
    const rngB = createSeededRng(TEST_SEED);
    const shoeA = buildShoe(8, rngA);
    const shoeB = buildShoe(8, rngB);
    expect(shoeA.map((c) => `${c.rank}${c.suit}`)).toEqual(shoeB.map((c) => `${c.rank}${c.suit}`));
  });

  it("deals four to six LIVE_INPUT reveals then RESULT_RECORDED", () => {
    const rng = createSeededRng(TEST_SEED);
    const out = baccaratVirtualStep({
      state: initialState(DEFAULT_BACCARAT_RULES),
      rules: DEFAULT_BACCARAT_RULES,
      rng,
      trigger: "deal",
      session: null,
      seriesId: "s1",
    });

    const live = out.events.filter((e) => e.type === "LIVE_INPUT");
    const result = out.events.find((e) => e.type === "RESULT_RECORDED");
    expect(live.length).toBeGreaterThanOrEqual(4);
    expect(live.length).toBeLessThanOrEqual(6);
    expect(result?.type).toBe("RESULT_RECORDED");
    if (result?.type === "RESULT_RECORDED") {
      expect(result.result.source).toBe("virtual");
      expect(result.result.by).toBe("system");
      expect(result.result.data.outcome).toMatch(/^[PBT]$/);
    }
  });

  it("fixed seed produces deterministic first hand", () => {
    const rng1 = createSeededRng(TEST_SEED);
    const rng2 = createSeededRng(TEST_SEED);
    const a = baccaratVirtualStep({
      state: initialState(DEFAULT_BACCARAT_RULES),
      rules: DEFAULT_BACCARAT_RULES,
      rng: rng1,
      trigger: "deal",
      session: null,
      seriesId: "s1",
    });
    const b = baccaratVirtualStep({
      state: initialState(DEFAULT_BACCARAT_RULES),
      rules: DEFAULT_BACCARAT_RULES,
      rng: rng2,
      trigger: "deal",
      session: null,
      seriesId: "s1",
    });
    const resultA = a.events.find((e) => e.type === "RESULT_RECORDED");
    const resultB = b.events.find((e) => e.type === "RESULT_RECORDED");
    expect(resultA).toEqual(resultB);
  });

  it("applies first_card_value burn rule", () => {
    const rules = { ...DEFAULT_BACCARAT_RULES, burnRule: "first_card_value" as const };
    const noBurn = baccaratVirtualStep({
      state: initialState(DEFAULT_BACCARAT_RULES),
      rules: DEFAULT_BACCARAT_RULES,
      rng: createSeededRng(TEST_SEED),
      trigger: "deal",
      session: null,
      seriesId: "s1",
    });
    const withBurn = baccaratVirtualStep({
      state: initialState(rules),
      rules,
      rng: createSeededRng(TEST_SEED),
      trigger: "deal",
      session: null,
      seriesId: "s1",
    });
    const r0 = noBurn.events.find((e) => e.type === "RESULT_RECORDED");
    const r1 = withBurn.events.find((e) => e.type === "RESULT_RECORDED");
    if (r0?.type === "RESULT_RECORDED" && r1?.type === "RESULT_RECORDED") {
      expect(r0.result.data).not.toEqual(r1.result.data);
    }
  });

  it("emits series rollover when shoe is near cut", () => {
    const rules = DEFAULT_BACCARAT_RULES;
    let session: VirtualShoeSession | null = null;
    const seriesId = "s1";
    let rollover = false;
    const rng = createSeededRng(TEST_SEED);

    for (let i = 0; i < 200 && !rollover; i++) {
      const out = baccaratVirtualStep({
        state: initialState(rules),
        rules,
        rng,
        trigger: "deal",
        session,
        seriesId,
      });
      rollover = out.seriesRollover;
      session = out.session;
      if (out.seriesRollover) {
        expect(out.events.some((e) => e.type === "SERIES_ENDED")).toBe(true);
        expect(out.events.some((e) => e.type === "SERIES_STARTED")).toBe(true);
        break;
      }
    }
    expect(rollover).toBe(true);
  });
});
