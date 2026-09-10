import { describe, expect, it } from "vitest";
import { createStubModule } from "@casino-lord/core/testing";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";
import {
  effectiveColor,
  enrichAnimationVars,
  resolvePreset,
  substituteBannerText,
} from "./presets.js";

describe("presets", () => {
  it("enriches outcome var from event id", () => {
    expect(enrichAnimationVars("banker_win", { total: 8 })).toEqual({
      total: 8,
      outcome: "BANKER",
    });
  });

  it("substitutes banner template vars", () => {
    expect(
      substituteBannerText("{outcome} DRAGON × {streak}", { outcome: "PLAYER", streak: 7 }),
    ).toBe("PLAYER DRAGON × 7");
    expect(substituteBannerText("PLAYER {total}", { total: 9 })).toBe("PLAYER 9");
  });

  it("uses chips as default big_win platform preset", () => {
    const module = asUntypedModule(createStubModule());
    const preset = resolvePreset("big_win", module, {});
    expect(preset.style).toBe("chips");
  });

  it("falls back to module default preset", () => {
    const module = asUntypedModule(baccaratModule);
    const preset = resolvePreset("player_win", module, {});
    expect(preset.style).toBe("sweep");
    expect(preset.enabled).toBe(true);
  });

  it("applies game-scoped table override", () => {
    const module = asUntypedModule(createStubModule());
    const preset = resolvePreset("player_win", module, {
      animations: {
        "game.player_win": {
          enabled: true,
          style: "banner",
          durationMs: 500,
          intensity: 2,
          text: "OVERRIDE",
          sound: null,
          soundVolume: 0.5,
          blockBoardUpdate: false,
        },
      },
    });
    expect(preset.style).toBe("banner");
    expect(preset.text).toBe("OVERRIDE");
  });

  it("uses semantic baccarat colours", () => {
    expect(
      effectiveColor(
        {
          enabled: true,
          style: "flash",
          durationMs: 1,
          intensity: 1,
          sound: null,
          soundVolume: 0,
          blockBoardUpdate: false,
        },
        "player_win",
        {},
      ),
    ).toBe("#2F6FE4");
    expect(
      effectiveColor(
        {
          enabled: true,
          style: "flash",
          durationMs: 1,
          intensity: 1,
          sound: null,
          soundVolume: 0,
          blockBoardUpdate: false,
        },
        "dragon",
        { outcome: "BANKER" },
      ),
    ).toBe("#E5322D");
  });
});
