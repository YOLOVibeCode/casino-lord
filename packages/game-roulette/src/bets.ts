import type { BetCatalogue, PlacedBet } from "@casino-lord/core";
import type { RouletteBetId, RouletteBetTarget } from "./bet-target.js";
import { payoutRatio } from "./payout-table.js";
import type { RouletteRules } from "./rules.js";
import type { RouletteState } from "./state.js";
import type { RouletteResult } from "./types.js";
import { totalCallUnits } from "./call-bets.js";

function callNote(kind: RouletteBetId): string {
  return `${totalCallUnits(kind)} units placed from entered unit stake`;
}

export const rouletteBets: BetCatalogue<
  RouletteRules,
  RouletteResult,
  RouletteState,
  RouletteBetTarget
> = {
  groups: [
    {
      id: "inside",
      label: "Inside",
      bets: [
        {
          id: "straight",
          label: "Straight",
          lifecycle: "round",
          targets: "custom",
          pays: (rules) => payoutRatio("straight", rules),
        },
        {
          id: "split",
          label: "Split",
          lifecycle: "round",
          targets: "custom",
          pays: (rules) => payoutRatio("split", rules),
        },
        {
          id: "street",
          label: "Street",
          lifecycle: "round",
          targets: "custom",
          pays: (rules) => payoutRatio("street", rules),
        },
        {
          id: "corner",
          label: "Corner",
          lifecycle: "round",
          targets: "custom",
          pays: (rules) => payoutRatio("corner", rules),
        },
        {
          id: "six_line",
          label: "Six Line",
          lifecycle: "round",
          targets: "custom",
          pays: (rules) => payoutRatio("six_line", rules),
        },
        {
          id: "basket",
          label: "Basket (0-1-2-3)",
          lifecycle: "round",
          pays: (rules) => payoutRatio("basket", rules),
        },
        {
          id: "top_line",
          label: "Top Line (0-00-1-2-3)",
          lifecycle: "round",
          pays: (rules) => payoutRatio("top_line", rules),
        },
      ],
    },
    {
      id: "outside",
      label: "Outside",
      bets: [
        {
          id: "dozen",
          label: "Dozen",
          lifecycle: "round",
          targets: "custom",
          pays: (rules) => payoutRatio("dozen", rules),
        },
        {
          id: "column",
          label: "2 to 1",
          lifecycle: "round",
          targets: "custom",
          pays: (rules) => payoutRatio("column", rules),
        },
        { id: "red", label: "Red", lifecycle: "round", pays: (rules) => payoutRatio("red", rules) },
        {
          id: "black",
          label: "Black",
          lifecycle: "round",
          pays: (rules) => payoutRatio("black", rules),
        },
        { id: "odd", label: "Odd", lifecycle: "round", pays: (rules) => payoutRatio("odd", rules) },
        {
          id: "even",
          label: "Even",
          lifecycle: "round",
          pays: (rules) => payoutRatio("even", rules),
        },
        {
          id: "low",
          label: "1–18",
          lifecycle: "round",
          pays: (rules) => payoutRatio("low", rules),
        },
        {
          id: "high",
          label: "19–36",
          lifecycle: "round",
          pays: (rules) => payoutRatio("high", rules),
        },
      ],
    },
    {
      id: "call",
      label: "Call",
      bets: [
        {
          id: "voisins",
          label: "Voisins du Zéro",
          lifecycle: "round",
          pays: () => "itemised",
          note: () => callNote("voisins"),
        },
        {
          id: "tiers",
          label: "Tiers du Cylindre",
          lifecycle: "round",
          pays: () => "itemised",
          note: () => callNote("tiers"),
        },
        {
          id: "orphelins",
          label: "Orphelins",
          lifecycle: "round",
          pays: () => "itemised",
          note: () => callNote("orphelins"),
        },
        {
          id: "jeu_zero",
          label: "Jeu Zéro",
          lifecycle: "round",
          pays: () => "itemised",
          note: () => callNote("jeu_zero"),
        },
        {
          id: "neighbours",
          label: "Neighbours",
          lifecycle: "round",
          targets: "custom",
          pays: () => "itemised",
          note: () => callNote("neighbours"),
        },
      ],
    },
  ],

  summary(bets: PlacedBet<RouletteBetTarget>[], _state: RouletteState) {
    const sum = (labels: string[]) => {
      const matching = bets.filter((b) => labels.includes(b.type));
      return {
        amount: matching.reduce((a, b) => a + b.amount, 0),
        count: matching.length,
      };
    };
    const red = sum(["red"]);
    const black = sum(["black"]);
    const inside = sum(["straight", "split", "street", "corner", "six_line", "basket", "top_line"]);
    return [
      { label: "RED", ...red },
      { label: "BLACK", ...black },
      { label: "INSIDE", ...inside },
    ];
  },
};
