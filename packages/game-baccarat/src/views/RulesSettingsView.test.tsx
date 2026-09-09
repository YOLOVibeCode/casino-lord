/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BACCARAT_RULES } from "../rules.js";
import { RulesSettingsView } from "./RulesSettingsView.js";

describe("RulesSettingsView", () => {
  afterEach(() => cleanup());

  it("emits partial when decks changed", () => {
    const onChange = vi.fn();
    render(<RulesSettingsView rules={DEFAULT_BACCARAT_RULES} onChange={onChange} />);
    const sixDeck = screen.getByRole("radio", { name: /6$/ });
    fireEvent.click(sixDeck);
    expect(onChange).toHaveBeenCalledWith({ decks: 6 });
  });

  it("emits partial when commission changed", () => {
    const onChange = vi.fn();
    render(<RulesSettingsView rules={DEFAULT_BACCARAT_RULES} onChange={onChange} />);
    const noCommission = screen.getByRole("radio", { name: /0 \(no commission\)/ });
    fireEvent.click(noCommission);
    expect(onChange).toHaveBeenCalledWith({ bankerCommission: 0 });
  });

  it("emits partial when prediction cells toggled", () => {
    const onChange = vi.fn();
    render(<RulesSettingsView rules={DEFAULT_BACCARAT_RULES} onChange={onChange} />);
    const checkbox = screen.getByRole("checkbox", { name: /Prediction cells/ });
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ predictionCells: true });
  });

  it("emits partial when dragon threshold changed", () => {
    const onChange = vi.fn();
    render(<RulesSettingsView rules={DEFAULT_BACCARAT_RULES} onChange={onChange} />);
    const slider = screen.getByLabelText(/Dragon threshold/);
    fireEvent.input(slider, { target: { value: "8" } });
    expect(onChange).toHaveBeenCalledWith({ dragonThreshold: 8 });
  });
});
