export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type Suit = "S" | "H" | "D" | "C";
export type Seat = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type SeatOutcome = "win" | "lose" | "push" | "blackjack" | "bust" | "surrender";
export type EntryDepth = "outcomes" | "full" | "quick";
export type DealerStatus = "must_draw" | "stands" | "bust" | "blackjack";

export interface Card {
  rank: Rank;
  suit: Suit | null;
}

export interface HandInput {
  cards: Card[];
  doubled: boolean;
  fromSplit: boolean;
  surrendered: boolean;
  outcome: SeatOutcome | null;
}

export interface BlackjackResult {
  dealer: {
    cards: Card[];
    total: number | null;
    bust: boolean;
    blackjack: boolean;
  };
  seats: Partial<Record<Seat, HandInput[]>>;
  depth: EntryDepth;
  dealerError: boolean;
}

export interface VirtualSession {
  shoe: Card[];
  shoeIndex: number;
  phase: "deal" | "insurance" | "player" | "dealer" | "complete";
  activeSeats: Seat[];
  currentSeat: Seat | null;
  currentHandIndex: number;
  holeDealt: boolean;
  dealRound: number;
  completedHands: string[];
  /** ISO timestamp when the current player turn began (for action timer). */
  turnStartedAt?: string;
}

export interface BlackjackLiveInput {
  dealer: Card[];
  seats: Partial<Record<Seat, HandInput[]>>;
  recordDespiteDealerError?: boolean;
  virtual?: VirtualSession;
}

export interface HandValue {
  total: number;
  soft: boolean;
  blackjack: boolean;
  bust: boolean;
  fiveCard21: boolean;
}

export interface DealerValidation {
  dealerStatus: DealerStatus;
  illegalActions: string[];
  total: number | null;
  soft: boolean;
}

export const ALL_SEATS: readonly Seat[] = [1, 2, 3, 4, 5, 6, 7];
