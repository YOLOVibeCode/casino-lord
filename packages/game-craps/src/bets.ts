import type { BetCatalogue, PlacedBet } from "@casino-lord/core";
import type { CrapsBetId } from "./bet-target.js";
import type { CrapsBetTarget } from "./bet-target.js";
import { maxOddsMultiple, placeOdds, trueOddsDenominator, trueOddsNumerator } from "./engine.js";
import { DEFAULT_CRAPS_RULES, type CrapsRules } from "./rules.js";
import type { CrapsResult, CrapsState, Point } from "./types.js";

function pointFromTarget(target: CrapsBetTarget | undefined): Point | undefined {
  return target?.kind === "point" ? target.value : undefined;
}

export const crapsBets: BetCatalogue<CrapsRules, CrapsResult, CrapsState, CrapsBetTarget> = {
  groups: [
    {
      id: "line",
      label: "Line",
      bets: [
        {
          id: "pass",
          label: "Pass Line",
          lifecycle: "working",
          pays: () => ({ num: 1, den: 1 }),
          allowedWhen: (state: CrapsState) =>
            state.phase === "come_out" || DEFAULT_CRAPS_RULES.putBets
              ? true
              : "Pass line: only on come-out",
        },
        {
          id: "dont_pass",
          label: "Don't Pass",
          lifecycle: "working",
          pays: () => ({ num: 1, den: 1 }),
          allowedWhen: (state: CrapsState) =>
            state.phase === "come_out" || DEFAULT_CRAPS_RULES.putBets
              ? true
              : "Don't pass: only on come-out",
        },
        {
          id: "come",
          label: "Come",
          lifecycle: "working",
          pays: () => ({ num: 1, den: 1 }),
          allowedWhen: (state: CrapsState) =>
            state.phase === "point" ? true : "Come: only during point phase",
        },
        {
          id: "dont_come",
          label: "Don't Come",
          lifecycle: "working",
          pays: () => ({ num: 1, den: 1 }),
          allowedWhen: (state: CrapsState) =>
            state.phase === "point" ? true : "Don't come: only during point phase",
        },
      ],
    },
    {
      id: "odds",
      label: "Odds",
      bets: [
        {
          id: "pass_odds",
          label: "Odds",
          lifecycle: "working",
          targets: "custom",
          pays: (_rules, ctx) => {
            const point = ctx?.state?.point ?? pointFromTarget(ctx?.target);
            if (!point) return { num: 1, den: 1 };
            return { num: trueOddsNumerator(point), den: trueOddsDenominator(point) };
          },
          limits: () => ({ maxMultipleOf: "pass" }),
        },
        {
          id: "dont_odds",
          label: "Lay Odds",
          lifecycle: "working",
          targets: "custom",
          pays: (_rules, ctx) => {
            const point = ctx?.state?.point ?? pointFromTarget(ctx?.target);
            if (!point) return { num: 1, den: 2 };
            return { num: trueOddsDenominator(point), den: trueOddsNumerator(point) };
          },
          limits: () => ({ maxMultipleOf: "dont_pass" }),
        },
      ],
    },
    {
      id: "place",
      label: "Place",
      bets: [
        {
          id: "place",
          label: "Place",
          lifecycle: "working",
          targets: "number",
          pays: (_rules, ctx) => {
            const point = pointFromTarget(ctx?.target);
            if (!point) return { num: 1, den: 1 };
            return placeOdds(point);
          },
        },
        {
          id: "buy",
          label: "Buy",
          lifecycle: "working",
          targets: "number",
          pays: (_rules, ctx) => {
            const point = pointFromTarget(ctx?.target);
            if (!point) return { num: 2, den: 1 };
            return { num: trueOddsNumerator(point), den: trueOddsDenominator(point) };
          },
          note: () => "5% vig",
        },
        {
          id: "lay",
          label: "Lay",
          lifecycle: "working",
          targets: "number",
          pays: (_rules, ctx) => {
            const point = pointFromTarget(ctx?.target);
            if (!point) return { num: 1, den: 2 };
            return { num: trueOddsDenominator(point), den: trueOddsNumerator(point) };
          },
          note: () => "5% vig on win",
        },
      ],
    },
    {
      id: "one-roll",
      label: "One Roll",
      bets: [
        {
          id: "field",
          label: "Field",
          lifecycle: "round",
          pays: () => ({ num: 1, den: 1 }),
          note: (rules) => `2 pays ${rules.field2}:1 · 12 pays ${rules.field12}:1`,
        },
        {
          id: "any_seven",
          label: "Any Seven",
          lifecycle: "round",
          pays: () => ({ num: 4, den: 1 }),
        },
        {
          id: "any_craps",
          label: "Any Craps",
          lifecycle: "round",
          pays: () => ({ num: 7, den: 1 }),
        },
        { id: "two", label: "Aces", lifecycle: "round", pays: () => ({ num: 30, den: 1 }) },
        { id: "twelve", label: "Midnight", lifecycle: "round", pays: () => ({ num: 30, den: 1 }) },
        { id: "three", label: "Ace-Deuce", lifecycle: "round", pays: () => ({ num: 15, den: 1 }) },
        { id: "eleven", label: "Yo", lifecycle: "round", pays: () => ({ num: 15, den: 1 }) },
        { id: "horn", label: "Horn", lifecycle: "round", pays: () => "itemised" },
        { id: "horn_high_2", label: "Horn High 2", lifecycle: "round", pays: () => "itemised" },
        { id: "horn_high_3", label: "Horn High 3", lifecycle: "round", pays: () => "itemised" },
        { id: "horn_high_11", label: "Horn High 11", lifecycle: "round", pays: () => "itemised" },
        { id: "horn_high_12", label: "Horn High 12", lifecycle: "round", pays: () => "itemised" },
        { id: "ce", label: "C & E", lifecycle: "round", pays: () => "itemised" },
      ],
    },
    {
      id: "multi-roll",
      label: "Multi Roll",
      bets: [
        {
          id: "hard",
          label: "Hard Way",
          lifecycle: "working",
          targets: "number",
          pays: (_rules, ctx) => {
            const point = pointFromTarget(ctx?.target);
            if (point === 4 || point === 10) return { num: 7, den: 1 };
            return { num: 9, den: 1 };
          },
        },
      ],
    },
    {
      id: "side",
      label: "Side",
      bets: [
        {
          id: "fire",
          label: "Fire Bet",
          lifecycle: "working",
          pays: (rules) => ({ num: rules.fire6, den: 1 }),
          allowedWhen: (state) =>
            state.shooter.rollCount === 0 ? true : "Fire: before shooter's first roll",
        },
        {
          id: "ats_small",
          label: "Small",
          lifecycle: "working",
          pays: () => ({ num: 34, den: 1 }),
          allowedWhen: (state) =>
            state.shooter.rollCount === 0 ? true : "Small: before shooter's first roll",
        },
        {
          id: "ats_tall",
          label: "Tall",
          lifecycle: "working",
          pays: () => ({ num: 34, den: 1 }),
          allowedWhen: (state) =>
            state.shooter.rollCount === 0 ? true : "Tall: before shooter's first roll",
        },
        {
          id: "ats_all",
          label: "All",
          lifecycle: "working",
          pays: () => ({ num: 175, den: 1 }),
          allowedWhen: (state) =>
            state.shooter.rollCount === 0 ? true : "All: before shooter's first roll",
        },
      ],
    },
  ],

  summary(bets: PlacedBet<CrapsBetTarget>[]) {
    const sumGroup = (types: CrapsBetId[]) => {
      const matching = bets.filter((b) => types.includes(b.type as CrapsBetId));
      return {
        amount: matching.reduce((a, b) => a + b.amount, 0),
        count: matching.length,
      };
    };

    return [
      { label: "PASS", ...sumGroup(["pass", "come"]) },
      { label: "DON'T", ...sumGroup(["dont_pass", "dont_come"]) },
      { label: "PLACE", ...sumGroup(["place", "buy", "lay"]) },
      { label: "FIELD", ...sumGroup(["field"]) },
      {
        label: "PROPS",
        ...sumGroup([
          "hard",
          "any_seven",
          "any_craps",
          "two",
          "twelve",
          "three",
          "eleven",
          "horn",
          "horn_high_2",
          "horn_high_3",
          "horn_high_11",
          "horn_high_12",
          "ce",
        ]),
      },
      { label: "FIRE", ...sumGroup(["fire", "ats_small", "ats_tall", "ats_all"]) },
    ];
  },
};
