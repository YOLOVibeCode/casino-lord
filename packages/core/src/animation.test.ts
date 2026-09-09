import { describe, expect, it } from "vitest";
import { animationPresetSchema } from "./animation.js";

describe("animationPresetSchema", () => {
  const valid = {
    enabled: true,
    style: "banner" as const,
    durationMs: 1200,
    intensity: 2 as const,
    text: "{outcome} WINS",
    sound: "flash",
    soundVolume: 0.6,
    blockBoardUpdate: false,
  };

  it("accepts a valid preset", () => {
    expect(animationPresetSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects duration below 200", () => {
    expect(animationPresetSchema.safeParse({ ...valid, durationMs: 100 }).success).toBe(false);
  });

  it("rejects duration above 4000", () => {
    expect(animationPresetSchema.safeParse({ ...valid, durationMs: 5000 }).success).toBe(false);
  });

  it("rejects invalid intensity", () => {
    expect(animationPresetSchema.safeParse({ ...valid, intensity: 4 }).success).toBe(false);
  });

  it("rejects invalid style", () => {
    expect(animationPresetSchema.safeParse({ ...valid, style: "invalid" }).success).toBe(false);
  });
});
