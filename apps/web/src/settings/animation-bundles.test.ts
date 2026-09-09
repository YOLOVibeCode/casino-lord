import { describe, expect, it, beforeEach } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";
import {
  BUILTIN_BUNDLE_IDS,
  buildBundleLoadPatch,
  listSavedBundles,
  saveBundle,
} from "./animation-bundles.js";

const baccarat = asUntypedModule(baccaratModule);

describe("animation-bundles", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
  });

  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };

  it("saves and lists bundles", () => {
    saveBundle(
      "baccarat",
      "My bundle",
      {
        "game.player_win": {
          enabled: true,
          style: "flash",
          durationMs: 400,
          intensity: 1,
          sound: null,
          soundVolume: 0.5,
          blockBoardUpdate: false,
        },
      },
      storage,
    );

    expect(listSavedBundles("baccarat", storage)).toHaveLength(1);
    expect(listSavedBundles("baccarat", storage)[0]?.name).toBe("My bundle");
  });

  it("loads quiet built-in bundle for baccarat", () => {
    const patch = buildBundleLoadPatch(
      BUILTIN_BUNDLE_IDS.quiet,
      "baccarat",
      baccarat,
      undefined,
      storage,
    );
    expect(patch["game.banker_win"]?.style).toBe("flash");
    expect(patch["game.banker_win"]?.durationMs).toBe(400);
    expect(patch["game.banker_win"]?.sound).toBeNull();
  });

  it("reset all clears game overrides", () => {
    const patch = buildBundleLoadPatch(
      BUILTIN_BUNDLE_IDS.resetAll,
      "baccarat",
      baccarat,
      {
        "game.player_win": {
          enabled: true,
          style: "banner",
          durationMs: 900,
          intensity: 2,
          sound: null,
          soundVolume: 0.5,
          blockBoardUpdate: false,
        },
      },
      storage,
    );
    expect(patch["game.player_win"]).toBeNull();
  });
});
