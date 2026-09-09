import { isEuropeanLayout, type RouletteRules } from "./rules.js";

export interface PayoutRow {
  group: string;
  bet: string;
  paysTo1: number | "itemised";
  note?: string;
}

export function payoutTable(rules: RouletteRules): PayoutRow[] {
  const rows: PayoutRow[] = [
    { group: "Inside", bet: "Straight", paysTo1: 35 },
    { group: "Inside", bet: "Split", paysTo1: 17 },
    { group: "Inside", bet: "Street", paysTo1: 11 },
    { group: "Inside", bet: "Corner", paysTo1: 8 },
    { group: "Inside", bet: "Six line", paysTo1: 5 },
  ];

  if (isEuropeanLayout(rules)) {
    rows.push({ group: "Inside", bet: "Basket / First four (0,1,2,3)", paysTo1: 8 });
  } else {
    rows.push({ group: "Inside", bet: "Top line (0,00,1,2,3)", paysTo1: 6 });
  }

  rows.push({ group: "Outside", bet: "Dozen / Column", paysTo1: 2 });
  const evenMoneyNote =
    rules.wheel === "french" && rules.zeroRule !== "none"
      ? `French: ${rules.zeroRule.replace("_", " ")} on zero`
      : undefined;
  rows.push({
    group: "Outside",
    bet: "Red/Black · Odd/Even · Low/High",
    paysTo1: 1,
    ...(evenMoneyNote !== undefined ? { note: evenMoneyNote } : {}),
  });

  if (isEuropeanLayout(rules) && rules.allowCallBets) {
    rows.push(
      { group: "Call (EU/FR)", bet: "Voisins du Zéro", paysTo1: "itemised" },
      { group: "Call (EU/FR)", bet: "Tiers du Cylindre", paysTo1: "itemised" },
      { group: "Call (EU/FR)", bet: "Orphelins", paysTo1: "itemised" },
      { group: "Call (EU/FR)", bet: "Jeu Zéro", paysTo1: "itemised" },
      { group: "Call (EU/FR)", bet: "Neighbours", paysTo1: "itemised" },
    );
  }

  if (rules.wheel === "french" && rules.zeroRule !== "none") {
    rows.push({
      group: "French",
      bet: "Zero hit — even-money bets",
      paysTo1: rules.zeroRule === "la_partage" ? 0 : 1,
      note:
        rules.zeroRule === "la_partage"
          ? "La partage: half stake returned"
          : "En prison: bet held for next spin",
    });
  }

  return rows;
}

export function payoutRatio(
  betId: string,
  rules: RouletteRules,
): { num: number; den: number } | "itemised" {
  const map: Record<string, { num: number; den: number } | "itemised"> = {
    straight: { num: 35, den: 1 },
    split: { num: 17, den: 1 },
    street: { num: 11, den: 1 },
    corner: { num: 8, den: 1 },
    six_line: { num: 5, den: 1 },
    basket: { num: 8, den: 1 },
    top_line: { num: 6, den: 1 },
    dozen: { num: 2, den: 1 },
    column: { num: 2, den: 1 },
    red: { num: 1, den: 1 },
    black: { num: 1, den: 1 },
    odd: { num: 1, den: 1 },
    even: { num: 1, den: 1 },
    low: { num: 1, den: 1 },
    high: { num: 1, den: 1 },
    voisins: "itemised",
    tiers: "itemised",
    orphelins: "itemised",
    jeu_zero: "itemised",
    neighbours: "itemised",
  };
  return map[betId] ?? { num: 0, den: 1 };
}
