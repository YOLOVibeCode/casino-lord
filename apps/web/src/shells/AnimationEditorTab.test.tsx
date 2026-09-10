/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { PLATFORM_ANIMATION_EVENTS } from "../animation/platform-events.js";
import { asUntypedModule } from "../table/module-types.js";
import { createTableStore } from "../table/store.js";
import { AnimationEditorTab } from "./AnimationEditorTab.js";

const baccarat = asUntypedModule(baccaratModule);

function expandEventRow(eventId: string): void {
  const row = screen.getByTestId(`animation-row-${eventId}`);
  fireEvent.click(row.querySelector(".animation-editor__summary")!);
}

describe("AnimationEditorTab", () => {
  afterEach(() => cleanup());

  it("renders one row per game and platform event", () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    render(<AnimationEditorTab store={store} module={baccarat} />);

    const expectedCount = baccarat.animationEvents.length + PLATFORM_ANIMATION_EVENTS.length;
    expect(screen.getAllByTestId(/^animation-row-/).length).toBe(expectedCount);
  });

  it("emits SETTINGS_CHANGED when style changes", () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    render(<AnimationEditorTab store={store} module={baccarat} />);
    expandEventRow("banker_win");

    fireEvent.change(screen.getByTestId("banker_win-style"), { target: { value: "banner" } });

    const changed = store.events.find((e) => e.type === "SETTINGS_CHANGED");
    expect(changed?.type).toBe("SETTINGS_CHANGED");
    if (changed?.type === "SETTINGS_CHANGED") {
      const preset = changed.patch.animations?.["game.banker_win"];
      expect(preset?.style).toBe("banner");
    }
  });

  it("emits ANIMATION_PREVIEW when Preview clicked", () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    render(<AnimationEditorTab store={store} module={baccarat} />);
    expandEventRow("banker_win");

    fireEvent.click(screen.getByTestId("banker_win-preview"));

    expect(store.events.some((e) => e.type === "ANIMATION_PREVIEW")).toBe(true);
  });

  it("lists spin and chips as enabled style options", () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    render(<AnimationEditorTab store={store} module={baccarat} />);
    expandEventRow("banker_win");

    const select = screen.getByTestId("banker_win-style") as HTMLSelectElement;
    const spin = select.querySelector('option[value="spin"]') as HTMLOptionElement;
    const chips = select.querySelector('option[value="chips"]') as HTMLOptionElement;
    expect(spin).toBeTruthy();
    expect(spin.disabled).toBe(false);
    expect(spin.textContent).toBe("Spin");
    expect(chips).toBeTruthy();
    expect(chips.disabled).toBe(false);
    expect(chips.textContent).toBe("Chips");
  });

  it("removes override on reset", () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "s1",
    });

    store.emit({
      type: "SETTINGS_CHANGED",
      patch: {
        animations: {
          "game.banker_win": {
            enabled: true,
            style: "banner",
            durationMs: 900,
            intensity: 2,
            text: "TEST",
            sound: null,
            soundVolume: 0.5,
            blockBoardUpdate: false,
          },
        },
      },
    });

    render(<AnimationEditorTab store={store} module={baccarat} />);
    expandEventRow("banker_win");

    fireEvent.click(screen.getByTestId("banker_win-reset"));

    const changed = [...store.events]
      .reverse()
      .find(
        (e) => e.type === "SETTINGS_CHANGED" && e.patch.animations?.["game.banker_win"] === null,
      );
    expect(changed).toBeTruthy();
  });
});
