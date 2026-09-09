export type CardRank = string;
export type CardSuit = string | null;

export interface PickedCard {
  rank: CardRank;
  suit: CardSuit;
}

export interface OutcomeChipDef {
  id: string;
  label: string;
  color: string;
  ariaLabel: string;
}
