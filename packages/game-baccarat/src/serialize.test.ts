import { describe, expect, it } from "vitest";
import { exportHands, importText, parseBodyTokens, stripEnvelopeHeader } from "./serialize.js";

describe("import/export", () => {
  it("parses outcome-only tokens", () => {
    const result = importText("B P P T Bb P");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hands).toHaveLength(6);
    expect(result.hands[4]!.roadHand.outcome).toBe("B");
    expect(result.hands[4]!.roadHand.bankerPair).toBe(true);
  });

  it("round-trips mixed tokens", () => {
    const input = "B P P T Bb B:7H,KS/4D,5C";
    const imported = importText(input);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    const exported = exportHands(imported.hands);
    const again = importText(exported);
    expect(again.ok).toBe(true);
  });

  it("recomputes carded hands and reports mismatches", () => {
    const result = importText("P:7H,KS/4D,5C");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain("outcome P ≠ recomputed B");
  });

  it("accepts valid carded hand", () => {
    const result = importText("B:7H,KS/4D,5C");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hands[0]!.result.outcome).toBe("B");
    expect(result.hands[0]!.result.bankerTotal).toBe(9);
  });

  it("strips envelope header", () => {
    const text = "#casino-lord v3 game=baccarat table=ABC123 series=1\nB P T";
    expect(stripEnvelopeHeader(text)).toBe("B P T");
    expect(parseBodyTokens(text)).toEqual(["B", "P", "T"]);
  });

  it("allows forced import on mismatch", () => {
    const result = importText("P:7H,KS/4D,5C", undefined, { force: true });
    expect(result.ok).toBe(true);
  });
});
