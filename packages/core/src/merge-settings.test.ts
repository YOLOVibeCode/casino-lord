import { describe, expect, it } from "vitest";
import { DEFAULT_TABLE_SETTINGS } from "./settings.js";
import { mergeTableSettings } from "./merge-settings.js";

const samplePreset = {
  enabled: true,
  style: "banner" as const,
  durationMs: 900,
  intensity: 2 as const,
  sound: null,
  soundVolume: 0.5,
  blockBoardUpdate: false,
};

describe("mergeTableSettings animations", () => {
  it("accumulates per-key animation overrides", () => {
    const first = mergeTableSettings(DEFAULT_TABLE_SETTINGS, {
      animations: { "game.player_win": samplePreset },
    });
    const second = mergeTableSettings(first, {
      animations: {
        "game.banker_win": { ...samplePreset, text: "BANKER" },
      },
    });
    expect(second.animations?.["game.player_win"]).toEqual(samplePreset);
    expect(second.animations?.["game.banker_win"]?.text).toBe("BANKER");
  });

  it("removes override keys when patch value is null", () => {
    const withOverrides = mergeTableSettings(DEFAULT_TABLE_SETTINGS, {
      animations: {
        "game.player_win": samplePreset,
        "game.banker_win": samplePreset,
      },
    });
    const cleared = mergeTableSettings(withOverrides, {
      animations: { "game.player_win": null },
    } as unknown as Parameters<typeof mergeTableSettings>[1]);
    expect(cleared.animations?.["game.player_win"]).toBeUndefined();
    expect(cleared.animations?.["game.banker_win"]).toEqual(samplePreset);
  });
});
