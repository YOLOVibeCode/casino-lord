/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { baccaratModule } from "@casino-lord/game-baccarat";
import { DEFAULT_BACCARAT_RULES } from "@casino-lord/game-baccarat";
import { PLAYER_COLORS } from "@casino-lord/core";
import { houseSettings } from "@casino-lord/core/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asUntypedModule } from "./module-types.js";
import { saveTableEvents } from "./persistence.js";
import {
  attachSoloBroadcastChannel,
  createSoloPlayerStore,
  getPlayerSettlementProfit,
  joinSoloPlayer,
  waitForSoloSnapshot,
} from "./solo-channel.js";
import { createTableStore, reopenTableStore } from "./store.js";

const baccarat = asUntypedModule(baccaratModule);

class FakeBroadcastChannel {
  static registry = new Map<string, Set<FakeBroadcastChannel>>();

  readonly name: string;
  private listeners = new Set<(ev: MessageEvent) => void>();
  private closed = false;

  constructor(name: string) {
    this.name = name;
    if (!FakeBroadcastChannel.registry.has(name)) {
      FakeBroadcastChannel.registry.set(name, new Set());
    }
    FakeBroadcastChannel.registry.get(name)!.add(this);
  }

  postMessage(data: unknown): void {
    if (this.closed) return;
    const peers = FakeBroadcastChannel.registry.get(this.name);
    if (!peers) return;
    queueMicrotask(() => {
      for (const peer of peers) {
        if (peer !== this && !peer.closed) {
          for (const listener of peer.listeners) {
            listener(new MessageEvent("message", { data }));
          }
        }
      }
    });
  }

  addEventListener(type: string, listener: (ev: MessageEvent) => void): void {
    if (type === "message") {
      this.listeners.add(listener);
    }
  }

  removeEventListener(type: string, listener: (ev: MessageEvent) => void): void {
    if (type === "message") {
      this.listeners.delete(listener);
    }
  }

  close(): void {
    this.closed = true;
    this.listeners.clear();
    FakeBroadcastChannel.registry.get(this.name)?.delete(this);
  }
}

function flushChannels(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

describe("solo broadcast channel", () => {
  beforeEach(() => {
    FakeBroadcastChannel.registry.clear();
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    sessionStorage.clear();
  });

  function createDealerStore() {
    let n = 0;
    return createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => `id-${n}`,
    });
  }

  function enableLocalPlayers(store: ReturnType<typeof createDealerStore>): void {
    store.emit({
      type: "PARTICIPATION_CHANGED",
      participation: houseSettings().participation,
    });
  }

  it("mirrors player BET_PLACED into the dealer store", async () => {
    const dealer = createDealerStore();
    enableLocalPlayers(dealer);
    const bridge = attachSoloBroadcastChannel(dealer, { module: baccarat });

    const join = await joinSoloPlayer({ code: dealer.code, name: "Ana", color: PLAYER_COLORS[0]! });
    expect(join.ok).toBe(true);
    if (!join.ok) return;

    const player = createSoloPlayerStore({
      code: dealer.code,
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      playerId: join.playerId,
      playerToken: join.playerToken,
    });

    await waitForSoloSnapshot(player);
    await flushChannels();

    dealer.emit({ type: "BETS_OPENED", roundId: "r1" });
    await flushChannels();

    player.emit({
      type: "BET_PLACED",
      bet: {
        id: "bet-1",
        playerId: join.playerId,
        roundId: "r1",
        type: "banker",
        amount: 100,
        placedAt: "2026-01-01T00:00:10.000Z",
      },
    });
    await flushChannels();

    expect(dealer.events.some((e) => e.type === "BET_PLACED")).toBe(true);

    player.destroy();
    bridge.detach();
  });

  it("mirrors dealer RESULT_RECORDED to player and settles", async () => {
    const dealer = createDealerStore();
    enableLocalPlayers(dealer);
    const bridge = attachSoloBroadcastChannel(dealer, { module: baccarat });

    const join = await joinSoloPlayer({ code: dealer.code, name: "Ana", color: PLAYER_COLORS[0]! });
    expect(join.ok).toBe(true);
    if (!join.ok) return;

    const player = createSoloPlayerStore({
      code: dealer.code,
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      playerId: join.playerId,
      playerToken: join.playerToken,
    });

    await waitForSoloSnapshot(player);
    await flushChannels();

    dealer.emit({ type: "BETS_OPENED", roundId: "r1" });
    await flushChannels();

    player.emit({
      type: "BET_PLACED",
      bet: {
        id: "bet-1",
        playerId: join.playerId,
        roundId: "r1",
        type: "banker",
        amount: 100,
        placedAt: "2026-01-01T00:00:10.000Z",
      },
    });
    await flushChannels();

    dealer.emit({ type: "BETS_CLOSED", roundId: "r1", by: "dealer" });
    await flushChannels();

    dealer.record(
      {
        cards: null,
        outcome: "B",
        playerTotal: 5,
        bankerTotal: 7,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );
    await flushChannels();

    const playerRound = player
      .getComposed()
      .platform.rounds.find((r) => r.id === "r1" && r.status === "settled");
    expect(playerRound).toBeTruthy();
    expect(getPlayerSettlementProfit(player, join.playerId, "r1")).not.toBe(0);

    player.destroy();
    bridge.detach();
  });

  it("drops ownership violations without logging them on the dealer", () => {
    const dealer = createDealerStore();
    enableLocalPlayers(dealer);
    const bridge = attachSoloBroadcastChannel(dealer, { module: baccarat });
    const channel = new FakeBroadcastChannel(`casino-lord:solo:${dealer.code}`);

    channel.postMessage({
      op: "playerEvent",
      clientId: "c1",
      playerId: "p1",
      event: {
        type: "BET_PLACED",
        bet: {
          id: "bet-bad",
          playerId: "other-player",
          roundId: "r1",
          type: "banker",
          amount: 100,
          placedAt: "2026-01-01T00:00:10.000Z",
        },
      },
    });

    expect(dealer.events.some((e) => e.type === "BET_PLACED")).toBe(false);

    bridge.detach();
    channel.close();
  });

  it("re-mirrors full log after dealer reload", async () => {
    let n = 0;
    const dealer = createTableStore({
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      rng: () => 0,
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => `id-${n}`,
    });
    enableLocalPlayers(dealer);
    dealer.record(
      {
        cards: null,
        outcome: "P",
        playerTotal: 8,
        bankerTotal: 6,
        playerPair: false,
        bankerPair: false,
        natural: false,
      },
      { quick: true },
    );

    await saveTableEvents(dealer.code, dealer.game, [...dealer.events]);

    const reopened = reopenTableStore({
      code: dealer.code,
      game: dealer.game,
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      events: [...dealer.events],
      now: () => `2026-01-01T00:00:0${++n}.000Z`,
      id: () => `id-${n}`,
    });

    const bridge = attachSoloBroadcastChannel(reopened, { module: baccarat });

    const join = await joinSoloPlayer({
      code: reopened.code,
      name: "Bob",
      color: PLAYER_COLORS[5]!,
    });
    expect(join.ok).toBe(true);
    if (!join.ok) return;

    const player = createSoloPlayerStore({
      code: reopened.code,
      game: "baccarat",
      module: baccarat,
      rules: DEFAULT_BACCARAT_RULES,
      playerId: join.playerId,
      playerToken: join.playerToken,
    });

    await waitForSoloSnapshot(player);
    await flushChannels();

    expect(player.events.some((e) => e.type === "RESULT_RECORDED")).toBe(true);
    expect(player.events.length).toBe(reopened.events.length);

    player.destroy();
    bridge.detach();
  });
});
