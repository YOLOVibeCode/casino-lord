/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ROULETTE_RULES } from "../rules.js";
import { RulesSettingsView } from "./RulesSettingsView.js";

describe("RulesSettingsView", () => {
  afterEach(() => cleanup());

  it("emits partial patch when wheel changes", () => {
    const onChange = vi.fn();
    render(<RulesSettingsView rules={DEFAULT_ROULETTE_RULES} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /american/i }));
    expect(onChange).toHaveBeenCalledWith({ wheel: "american" });
  });
});
