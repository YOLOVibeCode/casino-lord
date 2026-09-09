import type { Pocket } from "./types.js";
import type { RouletteBetTarget } from "./bet-target.js";

export interface CallComponent {
  label: string;
  target: RouletteBetTarget;
  units: number;
}

export const VOISINS_COMPONENTS: CallComponent[] = [
  { label: "0-2-3 street", target: { kind: "street", pockets: [0, 2, 3] }, units: 2 },
  { label: "4/7 split", target: { kind: "split", pockets: [4, 7] }, units: 1 },
  { label: "12/15 split", target: { kind: "split", pockets: [12, 15] }, units: 1 },
  { label: "18/21 split", target: { kind: "split", pockets: [18, 21] }, units: 1 },
  { label: "19/22 split", target: { kind: "split", pockets: [19, 22] }, units: 1 },
  { label: "32/35 split", target: { kind: "split", pockets: [32, 35] }, units: 1 },
  {
    label: "25-26-28-29 corner",
    target: { kind: "corner", pockets: [25, 26, 28, 29] },
    units: 2,
  },
];

export const TIERS_COMPONENTS: CallComponent[] = [
  { label: "5/8 split", target: { kind: "split", pockets: [5, 8] }, units: 1 },
  { label: "10/11 split", target: { kind: "split", pockets: [10, 11] }, units: 1 },
  { label: "13/16 split", target: { kind: "split", pockets: [13, 16] }, units: 1 },
  { label: "23/24 split", target: { kind: "split", pockets: [23, 24] }, units: 1 },
  { label: "27/30 split", target: { kind: "split", pockets: [27, 30] }, units: 1 },
  { label: "33/36 split", target: { kind: "split", pockets: [33, 36] }, units: 1 },
];

export const ORPHELINS_COMPONENTS: CallComponent[] = [
  { label: "straight 1", target: { kind: "straight", pocket: 1 }, units: 1 },
  { label: "6/9 split", target: { kind: "split", pockets: [6, 9] }, units: 1 },
  { label: "14/17 split", target: { kind: "split", pockets: [14, 17] }, units: 1 },
  { label: "17/20 split", target: { kind: "split", pockets: [17, 20] }, units: 1 },
  { label: "31/34 split", target: { kind: "split", pockets: [31, 34] }, units: 1 },
];

export const JEU_ZERO_COMPONENTS: CallComponent[] = [
  { label: "0/3 split", target: { kind: "split", pockets: [0, 3] }, units: 1 },
  { label: "12/15 split", target: { kind: "split", pockets: [12, 15] }, units: 1 },
  { label: "26 straight", target: { kind: "straight", pocket: 26 }, units: 1 },
  { label: "32/35 split", target: { kind: "split", pockets: [32, 35] }, units: 1 },
];

export function neighboursComponents(pocket: Pocket): CallComponent[] {
  return [{ label: `straight ${String(pocket)}`, target: { kind: "straight", pocket }, units: 1 }];
}

export function callComponents(kind: RouletteBetTarget["kind"], pocket?: Pocket): CallComponent[] {
  switch (kind) {
    case "voisins":
      return VOISINS_COMPONENTS;
    case "tiers":
      return TIERS_COMPONENTS;
    case "orphelins":
      return ORPHELINS_COMPONENTS;
    case "jeu_zero":
      return JEU_ZERO_COMPONENTS;
    case "neighbours":
      return pocket !== undefined ? neighboursComponents(pocket) : [];
    default:
      return [];
  }
}

export function totalCallUnits(kind: RouletteBetTarget["kind"]): number {
  switch (kind) {
    case "voisins":
      return 9;
    case "tiers":
      return 6;
    case "orphelins":
      return 5;
    case "jeu_zero":
      return 4;
    case "neighbours":
      return 5;
    default:
      return 1;
  }
}
