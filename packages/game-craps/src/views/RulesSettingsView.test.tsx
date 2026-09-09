/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CRAPS_RULES } from "../rules.js";
import { RulesSettingsView } from "./RulesSettingsView.js";

describe("RulesSettingsView", () => {
  afterEach(() => cleanup());

  it("emits trackFire patch", () => {
    const onChange = vi.fn();
    render(<RulesSettingsView rules={DEFAULT_CRAPS_RULES} onChange={onChange} />);
    const checkbox = screen.getByRole("checkbox", { name: /Track Fire Bet/i });
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ trackFire: false });
  });

  it("emits maxOdds patch", () => {
    const onChange = vi.fn();
    render(<RulesSettingsView rules={DEFAULT_CRAPS_RULES} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("5x"));
    expect(onChange).toHaveBeenCalledWith({ maxOdds: "5x" });
  });
});
