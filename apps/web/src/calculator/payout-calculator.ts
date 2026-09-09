import type { BetDef } from "@casino-lord/core";

export type RoundingMode = "down";

export interface BetPayoutRow {
  id: string;
  label: string;
  pays: string;
  note: string | undefined;
  profit: number;
  returned: number;
}

export function formatPays(pays: { num: number; den: number }): string {
  return `${pays.num}:${pays.den}`;
}

function roundChips(value: number, mode: RoundingMode): number {
  if (mode === "down") return Math.floor(value);
  return Math.floor(value);
}

export function computeBetRow<Rules>(
  bet: BetDef<Rules, unknown>,
  amount: number,
  rules: Rules,
  roundingMode: RoundingMode,
): BetPayoutRow | null {
  if (amount <= 0) return null;

  const paysResult = bet.pays(rules);
  if (paysResult === "itemised") return null;

  const profitRaw =
    bet.profit !== undefined
      ? bet.profit(amount, rules)
      : (amount * paysResult.num) / paysResult.den;
  const profit = roundChips(profitRaw, roundingMode);
  const returned = amount + profit;

  return {
    id: bet.id,
    label: bet.label,
    pays: formatPays(paysResult),
    note: bet.note?.(rules),
    profit,
    returned,
  };
}

export function computeAllBetRows<Rules>(
  groups: { bets: BetDef<Rules, unknown>[] }[],
  amount: number,
  rules: Rules,
  roundingMode: RoundingMode,
): BetPayoutRow[] {
  const rows: BetPayoutRow[] = [];
  for (const group of groups) {
    for (const bet of group.bets) {
      const row = computeBetRow(bet, amount, rules, roundingMode);
      if (row) rows.push(row);
    }
  }
  return rows;
}
