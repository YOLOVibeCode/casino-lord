import type { BettingRound, Player, PlayerState } from "@casino-lord/core";
import { FeltZones, usePlayerBetting, type FeltZoneDef } from "@casino-lord/ui";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { canPlaceEvenMoney, isActionEnabled, isMyTurn } from "../actions-enabled.js";
import type { BlackjackBetId } from "../bet-target.js";
import { handValue } from "../engine.js";
import type { BlackjackRules } from "../rules.js";
import type { BlackjackState } from "../state.js";
import { blackjackTurn, getLiveInput, isInsuranceWindow } from "../turn.js";
import type { HandInput, Seat } from "../types.js";
import type { BlackjackAction } from "../virtual.js";
import { formatCardGlyph, handTotalLabel, isRedSuit, outcomeDisplayLabel } from "./card-display.js";
import "./blackjack-tokens.css";
import "./player-view.css";

export interface PlayerViewProps {
  state: BlackjackState;
  rules: BlackjackRules;
  me: PlayerState;
  round: BettingRound;
  place: (bet: {
    playerId: string;
    roundId: string;
    type: string;
    amount: number;
    declared: boolean;
    working: boolean;
    originRoundId: string;
    target?: { seat: Seat; handIndex?: number };
  }) => void;
  remove: (betId: string) => void;
  act: (action: BlackjackAction) => void;
  seatAssign?: "dealer" | "player" | "auto";
  players?: Player[];
  selectSeat?: (seat: number) => void;
}

const ACTION_LABELS: Record<BlackjackAction, string> = {
  hit: "Hit",
  stand: "Stand",
  double: "Double",
  split: "Split",
  surrender: "Surrender",
};

function formatCountdown(deadlineMs: number | undefined): string | null {
  if (deadlineMs === undefined) return null;
  const sec = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function seatSummary(hands: HandInput[] | undefined, rules: BlackjackRules): string {
  if (!hands?.length) return "—";
  const hand = hands[0]!;
  if (hand.outcome) return outcomeDisplayLabel(hand.outcome);
  const hv = handValue(hand.cards, hand.fromSplit, rules.blackjackAfterSplit);
  if (hv.blackjack) return "BJ";
  if (hv.bust) return "BUST";
  if (hand.cards.length === 0) return "—";
  return String(hv.total);
}

function mainStake(me: PlayerState, seat: Seat): number {
  return me.openBets
    .filter((b) => {
      const target = b.target as { seat?: Seat } | undefined;
      return b.type === "main" && target?.seat === seat;
    })
    .reduce((s, b) => s + b.amount, 0);
}

export function PlayerView({
  state,
  rules,
  me,
  round,
  place,
  act,
  seatAssign,
  players = [],
  selectSeat,
}: PlayerViewProps) {
  const { onZoneTap, onZoneLongPress } = usePlayerBetting();
  const [otherSeatsOpen, setOtherSeatsOpen] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<BlackjackAction | null>(null);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  const liveInput = getLiveInput(state);
  const liveInputRef = useRef(liveInput);

  const mySeat = me.player.seat as Seat | undefined;
  const isPhysical = !liveInput.virtual;
  const insuranceOpen = isInsuranceWindow(state);
  const betsOpen = round.status === "open";
  const myTurn = mySeat !== undefined && isMyTurn(state, me, rules);
  const turnInfo = blackjackTurn(state, rules);
  const pending = myTurn ? turnInfo : null;

  useEffect(() => {
    const next = getLiveInput(state);
    if (liveInputRef.current !== next) {
      setPendingIntent(null);
      liveInputRef.current = next;
    }
  }, [state]);

  useEffect(() => {
    if (!pending?.deadlineMs) {
      setCountdownLabel(null);
      return;
    }
    const tick = (): void => setCountdownLabel(formatCountdown(pending.deadlineMs));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [pending?.deadlineMs]);

  const activeHandIndex = useMemo(() => {
    if (!mySeat || !myTurn) return 0;
    const virtual = getLiveInput(state).virtual;
    if (virtual?.phase === "player" && virtual.currentSeat === mySeat) {
      return virtual.currentHandIndex;
    }
    return 0;
  }, [mySeat, myTurn, state]);

  const bettingZones = useMemo((): FeltZoneDef[] => {
    const zones: FeltZoneDef[] = [
      {
        id: "main",
        label: "MAIN",
        sublabel: "Bet",
        color: "#D4AF37",
        target: { seat: mySeat ?? 1, betId: "main" as BlackjackBetId },
        className: "felt-zones__zone--main",
      },
    ];
    if (rules.sideBets && betsOpen && !insuranceOpen) {
      zones.push(
        {
          id: "perfect_pairs",
          label: "P PAIR",
          sublabel: "25:1",
          color: "#64748b",
          target: { seat: mySeat ?? 1, betId: "perfect_pairs" as BlackjackBetId },
          className: "felt-zones__zone--side",
        },
        {
          id: "twenty_one_plus_three",
          label: "21+3",
          sublabel: "100:1",
          color: "#64748b",
          target: { seat: mySeat ?? 1, betId: "twenty_one_plus_three" as BlackjackBetId },
          className: "felt-zones__zone--side",
        },
      );
    }
    if (insuranceOpen && mySeat !== undefined) {
      zones.push({
        id: "insurance",
        label: "INSURANCE",
        sublabel: "2:1",
        color: "#2563eb",
        target: { seat: mySeat, betId: "insurance" as BlackjackBetId },
        className: "felt-zones__zone--side",
      });
      if (canPlaceEvenMoney(state, rules, mySeat)) {
        zones.push({
          id: "even_money",
          label: "EVEN MONEY",
          sublabel: "1:1",
          color: "#16a34a",
          target: { seat: mySeat, betId: "even_money" as BlackjackBetId },
          className: "felt-zones__zone--side",
        });
      }
    }
    return zones;
  }, [betsOpen, insuranceOpen, mySeat, rules.sideBets, state, rules]);

  const showBetting = betsOpen && !myTurn && !pendingIntent;
  const myHands = mySeat !== undefined ? (liveInput.seats[mySeat] ?? []) : [];
  const dealerCards = liveInput.dealer;
  const holeHidden =
    dealerCards.length === 1 ||
    (liveInput.virtual !== undefined && !liveInput.virtual.holeDealt && rules.peek);
  const dealerVisible = dealerCards[0];
  const dealerTotal = holeHidden
    ? dealerVisible
      ? handValue([dealerVisible], false, rules.blackjackAfterSplit).total
      : null
    : handValue(dealerCards, false, rules.blackjackAfterSplit).total;

  const handleAction = (action: BlackjackAction): void => {
    act(action);
    if (isPhysical) {
      setPendingIntent(action);
      if (action === "double" || action === "split") {
        const stake = mainStake(me, mySeat!);
        if (stake > 0) {
          place({
            playerId: me.player.id,
            roundId: round.id,
            type: action,
            amount: stake,
            declared: false,
            working: false,
            originRoundId: round.id,
            target: { seat: mySeat!, handIndex: activeHandIndex },
          });
        }
      }
    }
  };

  const otherSeatSummaries = useMemo(() => {
    const parts: string[] = [];
    for (let s = 1; s <= rules.seats; s++) {
      const seat = s as Seat;
      if (seat === mySeat) continue;
      const hands = liveInput.seats[seat];
      if (!hands?.length) continue;
      parts.push(`${seat}: ${seatSummary(hands, rules)}`);
    }
    return parts;
  }, [mySeat, rules, liveInput.seats]);

  const occupiedSeats = useMemo(() => {
    const taken = new Set<number>();
    for (const player of players) {
      if (player.id !== me.player.id && player.seat !== undefined) {
        taken.add(player.seat);
      }
    }
    return taken;
  }, [me.player.id, players]);

  if (mySeat === undefined) {
    if (seatAssign === "player") {
      return (
        <div class="blackjack-player-view" data-testid="blackjack-player-view">
          <section class="blackjack-player-view__seat-picker" data-testid="seat-picker">
            <p class="blackjack-player-view__section-label">Pick a seat</p>
            <div class="blackjack-player-view__seat-picker-grid">
              {Array.from({ length: rules.seats }, (_, i) => {
                const seat = i + 1;
                const occupied = occupiedSeats.has(seat);
                return (
                  <button
                    key={seat}
                    type="button"
                    class="blackjack-player-view__seat-pick"
                    data-testid={`seat-pick-${seat}`}
                    disabled={occupied}
                    onClick={() => selectSeat?.(seat)}
                  >
                    {seat}
                    {occupied && <span class="blackjack-player-view__seat-pick-taken">Taken</span>}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      );
    }

    return (
      <div class="blackjack-player-view" data-testid="blackjack-player-view">
        <p class="blackjack-player-view__no-seat" data-testid="no-seat-message">
          Ask the dealer for a seat
        </p>
      </div>
    );
  }

  return (
    <div class="blackjack-player-view" data-testid="blackjack-player-view">
      <section class="blackjack-player-view__dealer" data-testid="dealer-strip">
        <div class="blackjack-player-view__section-label">DEALER</div>
        <div class="blackjack-player-view__cards">
          {dealerVisible && (
            <span
              class={`blackjack-player-view__card${dealerVisible.suit && isRedSuit(dealerVisible.suit) ? " blackjack-player-view__card--red" : ""}`}
            >
              {formatCardGlyph(dealerVisible)}
            </span>
          )}
          {holeHidden && (
            <span class="blackjack-player-view__card blackjack-player-view__card--down">▮▮</span>
          )}
          {!holeHidden &&
            dealerCards.slice(1).map((card, i) => (
              <span
                key={i}
                class={`blackjack-player-view__card${card.suit && isRedSuit(card.suit) ? " blackjack-player-view__card--red" : ""}`}
              >
                {formatCardGlyph(card)}
              </span>
            ))}
        </div>
        <div class="blackjack-player-view__total" data-testid="dealer-total">
          = {dealerTotal ?? "—"}
        </div>
      </section>

      <section class="blackjack-player-view__seat" data-testid="my-seat-panel">
        <div class="blackjack-player-view__section-label">
          SEAT {mySeat} — {me.player.name}
        </div>
        {myHands.map((hand, hi) => {
          const { label } = handTotalLabel(hand, rules);
          const active = myTurn && hi === activeHandIndex;
          return (
            <div
              key={hi}
              class={`blackjack-player-view__hand${active ? " blackjack-player-view__hand--active" : ""}`}
              data-testid={`my-hand-${hi}`}
            >
              {myHands.length > 1 && (
                <div class="blackjack-player-view__hand-label">Hand {hi + 1}</div>
              )}
              <div class="blackjack-player-view__cards">
                {hand.cards.map((card, ci) => (
                  <span
                    key={ci}
                    class={`blackjack-player-view__card${card.suit && isRedSuit(card.suit) ? " blackjack-player-view__card--red" : ""}`}
                  >
                    {formatCardGlyph(card)}
                  </span>
                ))}
              </div>
              <div class="blackjack-player-view__total" data-testid={`my-hand-total-${hi}`}>
                {label}
              </div>
            </div>
          );
        })}
        {mainStake(me, mySeat) > 0 && (
          <div class="blackjack-player-view__stake" data-testid="main-stake">
            ⛀{mainStake(me, mySeat)} main
          </div>
        )}
      </section>

      {pendingIntent && (
        <p class="blackjack-player-view__intent" data-testid="intent-message">
          Told the dealer: {ACTION_LABELS[pendingIntent].toUpperCase()}
        </p>
      )}

      {myTurn && !pendingIntent && (
        <section class="blackjack-player-view__actions" data-testid="action-area">
          <div class="blackjack-player-view__prompt" data-testid="turn-prompt">
            YOUR MOVE · {countdownLabel ?? formatCountdown(pending?.deadlineMs) ?? "—"}
          </div>
          <div class="blackjack-player-view__action-grid">
            {(["hit", "stand", "double", "split", "surrender"] as const).map((action) => {
              const enabled = isActionEnabled(action, state, me, rules);
              return (
                <button
                  key={action}
                  type="button"
                  class="blackjack-player-view__action-btn"
                  data-testid={`action-btn-${action}`}
                  disabled={!enabled}
                  onClick={() => handleAction(action)}
                >
                  {ACTION_LABELS[action]}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {showBetting && (
        <section class="blackjack-player-view__betting" data-testid="betting-area">
          <FeltZones
            zones={bettingZones}
            onTap={(zone) => onZoneTap(String((zone.target as { betId: string }).betId))}
            onLongPress={(zone) =>
              onZoneLongPress(String((zone.target as { betId: string }).betId))
            }
          />
        </section>
      )}

      {otherSeatSummaries.length > 0 && (
        <section class="blackjack-player-view__others" data-testid="other-seats">
          <button
            type="button"
            class="blackjack-player-view__others-toggle"
            data-testid="other-seats-toggle"
            onClick={() => setOtherSeatsOpen((v) => !v)}
          >
            Other seats {otherSeatsOpen ? "▾" : "▸"}{" "}
            {!otherSeatsOpen ? otherSeatSummaries.join(" · ") : ""}
          </button>
          {otherSeatsOpen && (
            <ul class="blackjack-player-view__others-list" data-testid="other-seats-list">
              {otherSeatSummaries.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
