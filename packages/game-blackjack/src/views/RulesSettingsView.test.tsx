/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BLACKJACK_RULES } from "../rules.js";
import { RulesSettingsView } from "./RulesSettingsView.js";

afterEach(() => cleanup());

describe("RulesSettingsView", () => {
  it("emits partial patch when dealer soft 17 changes", () => {
    const onChange = vi.fn();
    render(<RulesSettingsView rules={DEFAULT_BLACKJACK_RULES} onChange={onChange} />);

    const hitRadio = screen.getByLabelText("Hit (H17)");
    fireEvent.click(hitRadio);

    expect(onChange).toHaveBeenCalledWith({ dealerSoft17: "hit" });
  });

  it("emits partial patch when seats count changes", () => {
    const onChange = vi.fn();
    render(<RulesSettingsView rules={DEFAULT_BLACKJACK_RULES} onChange={onChange} />);

    const fiveSeats = screen.getByLabelText("5");
    fireEvent.click(fiveSeats);

    expect(onChange).toHaveBeenCalledWith({ seats: 5 });
  });
});
