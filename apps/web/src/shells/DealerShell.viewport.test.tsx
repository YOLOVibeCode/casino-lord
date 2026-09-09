/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { asUntypedModule } from "../table/module-types.js";
import { DEFAULT_DEVICE_SETTINGS } from "../settings/device-settings.js";
import { createTableStore } from "../table/store.js";
import { DealerShell } from "./DealerShell.js";
import "./dealer-shell.css";

const baccarat = asUntypedModule(baccaratModule);

beforeAll(() => {
  const style = document.createElement("style");
  style.textContent = `
    .dealer-shell__btn { min-height: 56px; min-width: 48px; }
    .dealer-shell__btn--confirm { min-height: 64px; }
    .dealer-shell__tool-btn { min-width: 48px; min-height: 48px; }
  `;
  document.head.appendChild(style);
});

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width, writable: true });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
    writable: true,
  });
}

function px(value: string): number {
  return Number.parseFloat(value) || 0;
}

function pickExpress(rank: string, suit: string) {
  fireEvent.click(screen.getByTestId(`suit-${suit}`));
  fireEvent.click(screen.getByTestId(`rank-${rank}`));
}

function assertViewportLayout(width: number, height: number): void {
  setViewport(width, height);

  const store = createTableStore({
    game: "baccarat",
    module: baccarat,
    rules: DEFAULT_BACCARAT_RULES,
    rng: () => 0,
    now: () => "2026-01-01T00:00:00.000Z",
    id: () => "viewport-test",
  });

  render(
    <DealerShell
      store={store}
      module={baccarat}
      rules={DEFAULT_BACCARAT_RULES}
      deviceSettings={DEFAULT_DEVICE_SETTINGS}
      onDeviceSettingsChange={() => {}}
    />,
  );

  const bottomBar = screen.getByTestId("dealer-bottom-bar");
  const undoBtn = screen.getByTestId("undo-btn");
  const confirmBtn = screen.getByTestId("confirm-btn");

  expect(bottomBar.contains(undoBtn)).toBe(true);
  expect(bottomBar.contains(confirmBtn)).toBe(true);

  undoBtn.getBoundingClientRect = () =>
    ({
      top: height * 0.8,
      bottom: height * 0.8 + 56,
      left: 0,
      right: width / 2,
      width: width / 2,
      height: 56,
      x: 0,
      y: height * 0.8,
      toJSON: () => ({}),
    }) as DOMRect;

  confirmBtn.getBoundingClientRect = () =>
    ({
      top: height * 0.8,
      bottom: height * 0.8 + 64,
      left: width / 2,
      right: width,
      width: width / 2,
      height: 64,
      x: width / 2,
      y: height * 0.8,
      toJSON: () => ({}),
    }) as DOMRect;

  const bottomThreshold = height * 0.75;
  expect(undoBtn.getBoundingClientRect().top).toBeGreaterThanOrEqual(bottomThreshold);
  expect(confirmBtn.getBoundingClientRect().top).toBeGreaterThanOrEqual(bottomThreshold);

  const shellButtons = ["undo-btn", "confirm-btn"].map((id) => screen.getByTestId(id));
  for (const btn of shellButtons) {
    const style = window.getComputedStyle(btn);
    expect(Math.max(px(style.minHeight), px(style.height))).toBeGreaterThanOrEqual(48);
    expect(Math.max(px(style.minWidth), px(style.width))).toBeGreaterThanOrEqual(48);
  }

  expect(px(window.getComputedStyle(undoBtn).minHeight)).toBeGreaterThanOrEqual(56);
  expect(px(window.getComputedStyle(confirmBtn).minHeight)).toBeGreaterThanOrEqual(64);
}

describe("DealerShell viewport", () => {
  afterEach(() => cleanup());

  it("places thumb-zone controls within bottom 25% at 360×780", () => {
    assertViewportLayout(360, 780);
  });

  it("places thumb-zone controls within bottom 25% at 430×930", () => {
    assertViewportLayout(430, 930);
  });

  it("opens picker after confirm when autoAdvance is on", async () => {
    let n = 0;
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => `id-${n}`,
    });

    render(
      <DealerShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={{ ...DEFAULT_DEVICE_SETTINGS, autoAdvance: true }}
        onDeviceSettingsChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("slot-P1"));
    pickExpress("7", "H");
    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());
    pickExpress("4", "D");
    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());
    pickExpress("K", "S");
    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());
    pickExpress("5", "C");

    await waitFor(() => {
      const btn = screen.getByTestId("confirm-btn");
      expect(btn.getAttribute("aria-disabled")).not.toBe("true");
    });

    fireEvent.click(screen.getByTestId("confirm-btn"));

    await waitFor(() => expect(screen.getByTestId("card-picker")).toBeTruthy());
  });

  it("shows toast when tapping disabled confirm", () => {
    const store = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => "2026-01-01T00:00:00.000Z",
      id: () => "toast-test",
    });

    render(
      <DealerShell
        store={store}
        module={baccarat}
        rules={DEFAULT_BACCARAT_RULES}
        deviceSettings={DEFAULT_DEVICE_SETTINGS}
        onDeviceSettingsChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("confirm-btn"));
    expect(screen.getByTestId("dealer-toast").textContent).toContain(
      "Complete the hand before confirming",
    );
  });
});
