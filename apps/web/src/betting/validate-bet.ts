import type { BetDef, BettingRound, PlayerStateForBet, TableSettings } from "@casino-lord/core";

export interface ValidateBetInput {
  betDef: BetDef<unknown, unknown, unknown>;
  settings: TableSettings;
  rules: unknown;
  round: BettingRound | null;
  bankroll: number;
  amount: number;
  pendingTotal: number;
  moduleState: unknown;
  me: PlayerStateForBet;
  houseBank: boolean;
}

export interface ValidateBetResult {
  ok: boolean;
  reason?: string;
}

function resolveMaxBet(
  limits: { min?: number; max?: number; maxMultipleOf?: string } | undefined,
  settings: TableSettings,
): number | undefined {
  if (!limits) return undefined;
  if (limits.max !== undefined) return limits.max;
  if (limits.maxMultipleOf) {
    const match = /^tableMax\/(\d+)$/.exec(limits.maxMultipleOf);
    if (match) {
      const divisor = Number(match[1]);
      const tableMax = settings.bank?.tableMax ?? 500;
      return Math.floor(tableMax / divisor);
    }
  }
  return undefined;
}

export function validateBet(input: ValidateBetInput): ValidateBetResult {
  const {
    betDef,
    settings,
    rules,
    round,
    bankroll,
    amount,
    pendingTotal,
    moduleState,
    me,
    houseBank,
  } = input;

  if (!round || round.status !== "open") {
    return { ok: false, reason: "Bets are closed" };
  }

  const tableMin = settings.bank.tableMin;
  const tableMax = settings.bank.tableMax;

  if (amount < tableMin) {
    return { ok: false, reason: `Minimum bet is ${tableMin}` };
  }

  const defMax = resolveMaxBet(betDef.limits?.(rules as never), settings);
  const maxBet = defMax !== undefined ? Math.min(tableMax, defMax) : tableMax;
  if (amount > maxBet) {
    return { ok: false, reason: `Maximum bet is ${maxBet}` };
  }

  if (betDef.allowedWhen) {
    const allowed = betDef.allowedWhen(moduleState as never, me);
    if (allowed !== true) {
      return { ok: false, reason: typeof allowed === "string" ? allowed : "Bet not allowed now" };
    }
  }

  if (houseBank) {
    const newTotal = pendingTotal + amount;
    if (bankroll < newTotal) {
      return { ok: false, reason: "Insufficient bankroll" };
    }
  }

  return { ok: true };
}

export function validatePlaceAll(
  bets: { betDef: BetDef<unknown, unknown, unknown>; amount: number }[],
  input: Omit<ValidateBetInput, "betDef" | "amount">,
): ValidateBetResult {
  let pendingTotal = input.pendingTotal;
  for (const bet of bets) {
    const result = validateBet({ ...input, betDef: bet.betDef, amount: bet.amount, pendingTotal });
    if (!result.ok) return result;
    pendingTotal += bet.amount;
  }
  return { ok: true };
}
