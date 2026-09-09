import { createContext } from "preact";
import { useContext } from "preact/hooks";

export interface PlayerBettingContextValue {
  selectedDenomination: number;
  showOthersBets: boolean;
  playerColor: string;
  getOwnStake: (zoneId: string) => number;
  getTableStake: (zoneId: string) => number;
  settlementFlash: "win" | "lose" | null;
  onZoneTap: (betType: string) => void;
  onZoneLongPress: (betType: string) => void;
}

export const PlayerBettingContext = createContext<PlayerBettingContextValue | null>(null);

export function usePlayerBetting(): PlayerBettingContextValue {
  const ctx = useContext(PlayerBettingContext);
  if (!ctx) {
    throw new Error("usePlayerBetting must be used within PlayerBettingContext.Provider");
  }
  return ctx;
}
