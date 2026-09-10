import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { TableEvent, TableEventType } from "./events.js";
import { getChipsInPlay } from "./betting-selectors.js";
import { canUndoResult } from "./betting-selectors.js";
import { getBankroll } from "./platform-state.js";
import { replay, stableStringify } from "./replay.js";
import {
  createStubModule,
  ev,
  houseSettings,
  resultEnvelope,
  STUB_RULES,
} from "./testing/stub-module.js";
import type { TableSettings } from "./settings.js";

const module = createStubModule();
const STUB_BET_TYPES = ["high", "low", "working"] as const;

interface SimState {
  seq: number;
  events: TableEvent[];
  playerIds: string[];
  bankrolls: Record<string, number>;
  chipsIssuedTotal: number;
  takenBack: number;
  roundId: string | null;
  roundStatus: "none" | "open" | "closed" | "settled";
  betIds: string[];
  resultIds: string[];
  lastResultId: string | null;
  settings: TableSettings;
}

function baseSim(settings: TableSettings): SimState {
  return {
    seq: 0,
    events: [],
    playerIds: [],
    bankrolls: {},
    chipsIssuedTotal: 0,
    takenBack: 0,
    roundId: null,
    roundStatus: "none",
    betIds: [],
    resultIds: [],
    lastResultId: null,
    settings,
  };
}

function pushEvent(
  sim: SimState,
  body: Record<string, unknown> & { type: TableEventType },
): SimState {
  sim.seq += 1;
  sim.events.push(ev(sim.seq, `2026-01-01T00:00:${String(sim.seq).padStart(2, "0")}.000Z`, body));
  return sim;
}

function initTable(sim: SimState): SimState {
  let next = pushEvent(sim, {
    type: "TABLE_CREATED",
    game: "baccarat",
    participation: sim.settings.participation,
    settings: sim.settings,
  });
  next = pushEvent(next, { type: "SERIES_STARTED", seriesId: "s1" });
  const count = 1 + (sim.seq % 2);
  for (let i = 0; i < count; i++) {
    const id = `p${i + 1}`;
    next.playerIds.push(id);
    next.bankrolls[id] = 0;
    next = pushEvent(next, {
      type: "PLAYER_JOINED",
      player: {
        id,
        name: `Player${i + 1}`,
        color: "#f00",
        status: "active",
        joinedAt: `2026-01-01T00:00:${String(next.seq).padStart(2, "0")}.000Z`,
      },
    });
  }
  return next;
}

type Command = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function applyCommand(sim: SimState, cmd: Command): SimState {
  if (sim.playerIds.length === 0) return sim;

  switch (cmd) {
    case 0: {
      const playerId = sim.playerIds[sim.seq % sim.playerIds.length]!;
      const amount = 50 + (sim.seq % 5) * 50;
      sim.chipsIssuedTotal += amount;
      sim.bankrolls[playerId] = (sim.bankrolls[playerId] ?? 0) + amount;
      return pushEvent(sim, {
        type: "BANK_ISSUED",
        playerId,
        amount,
        reason: "buyin",
      });
    }
    case 1: {
      const playerId = sim.playerIds[sim.seq % sim.playerIds.length]!;
      const bankroll = sim.bankrolls[playerId] ?? 0;
      if (bankroll <= 0) return sim;
      const take = Math.min(bankroll, 25 + (sim.seq % 4) * 25);
      sim.takenBack += take;
      sim.bankrolls[playerId] = bankroll - take;
      return pushEvent(sim, {
        type: "BANK_ADJUSTED",
        playerId,
        delta: -take,
        reason: "takeback",
      });
    }
    case 2: {
      if (sim.roundStatus !== "none" && sim.roundStatus !== "settled") return sim;
      const roundId = `r${sim.betIds.length + 1}`;
      sim.roundId = roundId;
      sim.roundStatus = "open";
      return pushEvent(sim, { type: "BETS_OPENED", roundId });
    }
    case 3: {
      if (sim.roundStatus !== "open" || !sim.roundId) return sim;
      const playerId = sim.playerIds[sim.seq % sim.playerIds.length]!;
      const bankroll = sim.bankrolls[playerId] ?? 0;
      const amount = 25 + (sim.seq % 3) * 25;
      if (bankroll < amount) return sim;
      const betId = `b${sim.betIds.length + 1}`;
      sim.betIds.push(betId);
      sim.bankrolls[playerId] = bankroll - amount;
      return pushEvent(sim, {
        type: "BET_PLACED",
        bet: {
          id: betId,
          playerId,
          roundId: sim.roundId,
          type: STUB_BET_TYPES[sim.seq % STUB_BET_TYPES.length]!,
          amount,
          declared: false,
          working: STUB_BET_TYPES[sim.seq % STUB_BET_TYPES.length] === "working",
          placedAt: `2026-01-01T00:00:${String(sim.seq).padStart(2, "0")}.000Z`,
          originRoundId: sim.roundId,
        },
      });
    }
    case 4: {
      if (sim.roundStatus !== "open" || !sim.roundId) return sim;
      sim.roundStatus = "closed";
      return pushEvent(sim, { type: "BETS_CLOSED", roundId: sim.roundId, by: "dealer" });
    }
    case 5: {
      if (sim.roundStatus !== "closed" || !sim.roundId) return sim;
      const resultId = `res${sim.resultIds.length + 1}`;
      sim.resultIds.push(resultId);
      sim.lastResultId = resultId;
      sim.roundStatus = "settled";
      const value = 5 + (sim.seq % 15);
      return pushEvent(sim, {
        type: "RESULT_RECORDED",
        result: resultEnvelope(resultId, sim.resultIds.length - 1, value, sim.roundId),
      });
    }
    case 6: {
      if (!sim.lastResultId) return sim;
      const composed = replay(sim.events, module, STUB_RULES, { code: "TEST01" });
      const undoId = sim.lastResultId;
      const undoCheck = canUndoResult(composed.platform, undoId);
      if (!undoCheck.ok) return sim;
      sim.resultIds.pop();
      sim.lastResultId = sim.resultIds.at(-1) ?? null;
      if (sim.roundId) sim.roundStatus = "closed";
      return pushEvent(sim, { type: "RESULT_UNDONE", resultId: undoId });
    }
    default:
      return sim;
  }
}

function assertChipConservation(events: TableEvent[], takenBack: number): void {
  const state = replay(events, module, STUB_RULES, { code: "TEST01" });
  const chips = getChipsInPlay(state.platform);
  const houseNet = chips.issued - takenBack - chips.inBankrolls - chips.onFelt;
  expect(chips.issued - takenBack).toBe(chips.inBankrolls + chips.onFelt + houseNet);
}

function assertNonNegativeBankrolls(events: TableEvent[]): void {
  const state = replay(events, module, STUB_RULES, { code: "TEST01" });
  for (const player of state.platform.players) {
    if (player.status === "removed") continue;
    expect(getBankroll(state.platform, player.id)).toBeGreaterThanOrEqual(0);
  }
}

function assertSettlementIntegers(events: TableEvent[]): void {
  const state = replay(events, module, STUB_RULES, { code: "TEST01" });
  for (const settlements of Object.values(state.platform.settlements)) {
    for (const s of settlements) {
      expect(Number.isInteger(s.profit)).toBe(true);
      expect(Number.isInteger(s.returned)).toBe(true);
    }
  }
}

describe("bank reducer properties", () => {
  for (const roundingMode of ["down"] as const) {
    it(`conserves chips under random event sequences (roundingMode=${roundingMode})`, () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 40 }),
          (cmds) => {
            const settings = houseSettings();
            settings.bank = { ...settings.bank, autoBuyIn: false, roundingMode };
            let sim = initTable(baseSim(settings));
            for (const cmd of cmds) {
              sim = applyCommand(sim, cmd as Command);
            }
            assertChipConservation(sim.events, sim.takenBack);
          },
        ),
        { numRuns: 150 },
      );
    });

    it(`keeps bankrolls non-negative when autoBuyIn is false (roundingMode=${roundingMode})`, () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 30 }),
          (cmds) => {
            const settings = houseSettings();
            settings.bank = { ...settings.bank, autoBuyIn: false, roundingMode };
            let sim = initTable(baseSim(settings));
            for (const cmd of cmds) {
              sim = applyCommand(sim, cmd as Command);
            }
            assertNonNegativeBankrolls(sim.events);
          },
        ),
        { numRuns: 150 },
      );
    });

    it(`RESULT_UNDONE restores composed-state fingerprint (roundingMode=${roundingMode})`, () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 3, maxLength: 25 }),
          (cmds) => {
            const settings = houseSettings();
            settings.bank = { ...settings.bank, autoBuyIn: false, roundingMode };
            let sim = initTable(baseSim(settings));
            for (const cmd of cmds) {
              sim = applyCommand(sim, cmd as Command);
            }
            sim = applyCommand(sim, 5);
            if (!sim.lastResultId) return;

            const beforeUndo = replay(sim.events, module, STUB_RULES, { code: "TEST01" });
            const fingerprint = stableStringify(beforeUndo);
            const undoCheck = canUndoResult(beforeUndo.platform, sim.lastResultId);
            if (!undoCheck.ok) return;

            sim = pushEvent(sim, { type: "RESULT_UNDONE", resultId: sim.lastResultId });
            const afterUndoPrefix = replay(sim.events.slice(0, -1), module, STUB_RULES, {
              code: "TEST01",
            });
            expect(stableStringify(afterUndoPrefix)).toBe(fingerprint);
          },
        ),
        { numRuns: 100 },
      );
    });

    it(`settlement totals are integers (roundingMode=${roundingMode})`, () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 35 }),
          (cmds) => {
            const settings = houseSettings();
            settings.bank = { ...settings.bank, roundingMode };
            let sim = initTable(baseSim(settings));
            for (const cmd of cmds) {
              sim = applyCommand(sim, cmd as Command);
            }
            assertSettlementIntegers(sim.events);
          },
        ),
        { numRuns: 150 },
      );
    });
  }
});
