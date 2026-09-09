import { DEFAULT_TABLE_SETTINGS } from "@casino-lord/core";
import { describe, expect, it } from "vitest";
import { validateBet } from "./validate-bet.js";

const betDef = {
  id: "banker",
  label: "BANKER",
  lifecycle: "round" as const,
  pays: () => ({ num: 1, den: 1 }),
};

const tieDef = {
  id: "tie",
  label: "TIE",
  lifecycle: "round" as const,
  pays: () => ({ num: 8, den: 1 }),
  limits: () => ({ maxMultipleOf: "tableMax/4" }),
};

const openRound = {
  id: "r1",
  status: "open" as const,
  openedAt: "2026-01-01T00:00:00.000Z",
};

describe("validateBet", () => {
  it("rejects when round closed", () => {
    const result = validateBet({
      betDef,
      settings: DEFAULT_TABLE_SETTINGS,
      rules: {},
      round: { ...openRound, status: "closed" },
      bankroll: 500,
      amount: 100,
      pendingTotal: 0,
      moduleState: {},
      me: { id: "p1", bankroll: 500 },
      houseBank: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("closed");
  });

  it("rejects insufficient bankroll", () => {
    const result = validateBet({
      betDef,
      settings: DEFAULT_TABLE_SETTINGS,
      rules: {},
      round: openRound,
      bankroll: 50,
      amount: 100,
      pendingTotal: 0,
      moduleState: {},
      me: { id: "p1", bankroll: 50 },
      houseBank: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Insufficient");
  });

  it("rejects over table max", () => {
    const result = validateBet({
      betDef,
      settings: DEFAULT_TABLE_SETTINGS,
      rules: {},
      round: openRound,
      bankroll: 1000,
      amount: 600,
      pendingTotal: 0,
      moduleState: {},
      me: { id: "p1", bankroll: 1000 },
      houseBank: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Maximum");
  });

  it("applies tie max divisor", () => {
    const result = validateBet({
      betDef: tieDef,
      settings: DEFAULT_TABLE_SETTINGS,
      rules: { tieMaxDivisor: 4 },
      round: openRound,
      bankroll: 1000,
      amount: 200,
      pendingTotal: 0,
      moduleState: {},
      me: { id: "p1", bankroll: 1000 },
      houseBank: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("125");
  });
});
