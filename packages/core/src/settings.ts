import type { Participation } from "./types.js";

/** Table settings broadcast via the log (SPEC.md §18). */
export interface TableSettings {
  participation: Participation;
  players: {
    maxPlayers: number;
    joinApproval: boolean;
    joiningOpen: boolean;
    showBankrolls: boolean;
    showOthersBets: boolean;
    playersSort: "bankroll" | "seat" | "joined";
  };
  bank: {
    defaultBuyIn: number;
    autoBuyIn: boolean;
    chipDenominations: number[];
    tableMin: number;
    tableMax: number;
    maxExposure: number;
    roundingMode: "down";
  };
  betting: {
    betTimerSec: number;
    autoOpenDelayMs: number;
    autoCloseOnEntry: boolean;
  };
  virtual: {
    revealDelayMs: number;
    diceTumbleMs: number;
    wheelSpinMs: number;
    actionTimerSec: number;
    shooterRotation: "join_order" | "dealer_assigns";
    autoTrigger: boolean;
  };
  tableName?: string;
  currency?: string;
  /** Game-specific rules; typed by each GameModule at runtime. */
  rules: unknown;
}

export const DEFAULT_TABLE_SETTINGS: TableSettings = {
  participation: { playerMode: "off", bank: "none", outcomeSource: "physical" },
  players: {
    maxPlayers: 20,
    joinApproval: false,
    joiningOpen: true,
    showBankrolls: true,
    showOthersBets: true,
    playersSort: "bankroll",
  },
  bank: {
    defaultBuyIn: 500,
    autoBuyIn: true,
    chipDenominations: [5, 25, 100, 500],
    tableMin: 5,
    tableMax: 500,
    maxExposure: 0,
    roundingMode: "down",
  },
  betting: {
    betTimerSec: 0,
    autoOpenDelayMs: 3000,
    autoCloseOnEntry: true,
  },
  virtual: {
    revealDelayMs: 900,
    diceTumbleMs: 1500,
    wheelSpinMs: 4000,
    actionTimerSec: 20,
    shooterRotation: "join_order",
    autoTrigger: false,
  },
  rules: {},
};
