export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type Suit = "S" | "H" | "D" | "C";
export type SlotId = "P1" | "P2" | "P3" | "B1" | "B2" | "B3";
export type Outcome = "P" | "B" | "T";

export interface Card {
  rank: Rank;
  suit: Suit | null;
}

export interface BaccaratResult {
  cards: Partial<Record<SlotId, Card>> | null;
  outcome: Outcome;
  playerTotal: number | null;
  bankerTotal: number | null;
  playerPair: boolean;
  bankerPair: boolean;
  natural: boolean;
}

export interface BaccaratLiveInput {
  slots: Partial<Record<SlotId, Card>>;
}

export type HandStatus =
  "awaiting_cards" | "needs_player_third" | "needs_banker_third" | "complete" | "invalid";

export interface HandError {
  slot: SlotId;
  message: string;
}

export interface HandState {
  status: HandStatus;
  nextSlot: SlotId | null;
  enabledSlots: SlotId[];
  playerTotal: number | null;
  bankerTotal: number | null;
  outcome: Outcome | null;
  playerPair: boolean;
  bankerPair: boolean;
  playerNatural: boolean;
  bankerNatural: boolean;
  hint: string;
  errors: HandError[];
  warnings: string[];
}

export interface RoadHand {
  outcome: Outcome;
  playerPair: boolean;
  bankerPair: boolean;
}

export type Slots = Partial<Record<SlotId, Card>>;
