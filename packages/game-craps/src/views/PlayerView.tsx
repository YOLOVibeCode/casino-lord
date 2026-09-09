import type { BettingRound, PlacedBet, PlayerState } from "@casino-lord/core";
import { PlayerBettingContext } from "@casino-lord/ui";
import { useCallback, useContext, useState } from "preact/hooks";
import type { CrapsAction } from "../actions.js";
import { crapsPlayerActions } from "../actions.js";
import type { CrapsBetId } from "../bet-target.js";
import { POINTS, type CrapsBetTarget } from "../bet-target.js";
import type { CrapsRules } from "../rules.js";
import type { CrapsState, Point, RollRecord } from "../types.js";
import { DicePair } from "./DiceFace.js";
import { puckLabel, rollBadge } from "./dice-display.js";
import {
  PROP_BET_IDS,
  SIDE_BET_IDS,
  betAllowed,
  buildPlacePayload,
  canTakeDown,
  isShooter,
  lookupBetDef,
  normalizeViewState,
  stakeOnPoint,
  travelledComeOnPoint,
} from "./player-view-helpers.js";
import { useLongPress } from "./use-long-press.js";
import { requestMotionPermission, useShakeToRoll } from "./use-shake-to-roll.js";
import "./craps-tokens.css";
import "./dealer-view.css";
import "./player-view.css";

export interface PlayerViewProps {
  state: CrapsState;
  rules: CrapsRules;
  me: PlayerState;
  round: BettingRound;
  place: (bet: Omit<PlacedBet<CrapsBetTarget>, "id" | "placedAt">) => void;
  remove: (betId: string) => void;
  act: (action: CrapsAction) => void;
}

function useStake(defaultAmount = 25): number {
  const ctx = useContext(PlayerBettingContext);
  return ctx?.selectedDenomination ?? defaultAmount;
}

function fireRoll(act: (action: CrapsAction) => void): void {
  // ROLL maps to virtual.trigger at shell level; not yet in CrapsAction union.
  // @ts-expect-error roll action pending shell wiring
  act({ kind: "roll" });
}

function BetMenuSheet({
  point,
  onSelect,
  onClose,
}: {
  point: Point;
  onSelect: (betId: "buy" | "lay" | "hard") => void;
  onClose: () => void;
}) {
  const rows: { id: "buy" | "lay" | "hard"; label: string }[] = [
    { id: "buy", label: `Buy ${point}` },
    { id: "lay", label: `Lay ${point}` },
    { id: "hard", label: `Hard ${point}` },
  ];

  return (
    <div class="craps-player-sheet__backdrop" data-testid="bet-menu-sheet" onClick={onClose}>
      <div
        class="craps-player-sheet__sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Place bets on ${point}`}
      >
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            class="craps-player-sheet__row"
            style={{ minHeight: "56px" }}
            data-testid={`bet-menu-${row.id}`}
            onClick={() => {
              onSelect(row.id);
              onClose();
            }}
          >
            {row.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlaceBox({
  point,
  state,
  rules,
  me,
  roundId,
  amount,
  place,
  onSelectBet,
}: {
  point: Point;
  state: CrapsState;
  rules: CrapsRules;
  me: PlayerState;
  roundId: string;
  amount: number;
  place: PlayerViewProps["place"];
  onSelectBet: (betId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const placeAllowed = betAllowed("place", state, me);
  const disabled = placeAllowed !== true;
  const reason = disabled ? placeAllowed : undefined;
  const comeBet = travelledComeOnPoint(me, point);
  const placeStake = stakeOnPoint(me, point, ["place", "buy", "lay", "hard"]);

  const handlePlace = useCallback(
    (betId: CrapsBetId, target?: CrapsBetTarget) => {
      if (betAllowed(betId, state, me) !== true) return;
      place(buildPlacePayload(betId, target, amount, me, roundId, rules, state));
    },
    [amount, me, place, roundId, rules, state],
  );

  const press = useLongPress({
    disabled,
    onTap: () => handlePlace("place", { kind: "point", value: point }),
    onLongPress: () => setMenuOpen(true),
  });

  return (
    <>
      <button
        type="button"
        class={`craps-player-view__place-box${disabled ? " craps-player-view__zone--disabled" : ""}`}
        style={{ minHeight: "56px" }}
        data-testid={`place-box-${point}`}
        aria-disabled={disabled}
        aria-label={`Place ${point}${reason ? `, ${reason}` : ""}`}
        onMouseDown={press.startPress}
        onMouseUp={press.endPress}
        onMouseLeave={press.cancelPress}
        onTouchStart={press.startPress}
        onTouchEnd={press.endPress}
        onTouchCancel={press.cancelPress}
        onKeyDown={(e) => press.handleKeyDown(e as unknown as KeyboardEvent)}
      >
        <span class="craps-player-view__place-num">{point}</span>
        {comeBet && (
          <span
            class="craps-player-view__come-chip"
            data-testid={`come-chip-${point}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBet(comeBet.id);
            }}
          >
            ⛀{comeBet.amount}
            <span class="craps-player-view__come-mark">C</span>
          </span>
        )}
        {placeStake > 0 && !comeBet && (
          <span
            class="craps-player-view__place-chip"
            onClick={(e) => {
              e.stopPropagation();
              const bet = me.openBets.find(
                (b) =>
                  (b.type === "place" ||
                    b.type === "buy" ||
                    b.type === "lay" ||
                    b.type === "hard") &&
                  b.target &&
                  typeof b.target === "object" &&
                  "kind" in b.target &&
                  (b.target as CrapsBetTarget).kind === "point" &&
                  (b.target as { kind: "point"; value: Point }).value === point,
              );
              if (bet) onSelectBet(bet.id);
            }}
          >
            ⛀{placeStake}
          </span>
        )}
        {reason && <span class="craps-player-view__zone-reason">{reason}</span>}
      </button>
      {menuOpen && (
        <BetMenuSheet
          point={point}
          onClose={() => setMenuOpen(false)}
          onSelect={(betId) => handlePlace(betId, { kind: "point", value: point })}
        />
      )}
    </>
  );
}

function BetZone({
  betId,
  label,
  state,
  rules,
  me,
  roundId,
  amount,
  place,
  target,
  className,
}: {
  betId: CrapsBetId;
  label: string;
  state: CrapsState;
  rules: CrapsRules;
  me: PlayerState;
  roundId: string;
  amount: number;
  place: PlayerViewProps["place"];
  target?: CrapsBetTarget;
  className?: string;
}) {
  const allowed = betAllowed(betId, state, me);
  const disabled = allowed !== true;
  const reason = disabled ? allowed : undefined;

  return (
    <button
      type="button"
      class={`craps-player-view__zone${className ? ` ${className}` : ""}${disabled ? " craps-player-view__zone--disabled" : ""}`}
      data-testid={`bet-zone-${betId}`}
      aria-disabled={disabled}
      aria-label={`${label}${reason ? `, ${reason}` : ""}`}
      onClick={() => {
        if (disabled) return;
        place(buildPlacePayload(betId, target, amount, me, roundId, rules, state));
      }}
    >
      <span class="craps-player-view__zone-label">{label}</span>
      {reason && <span class="craps-player-view__zone-reason">{reason}</span>}
    </button>
  );
}

function HistoryStrip({ rolls }: { rolls: RollRecord[] }) {
  return (
    <div class="craps-player-view__history" data-testid="roll-history">
      {rolls.map((roll) => {
        const badge = rollBadge(roll.info);
        return (
          <span key={roll.id} class="craps-player-view__history-item">
            <DicePair a={roll.a} b={roll.b} />
            <span>{roll.total}</span>
            {badge && <span class="craps-player-view__history-badge">{badge}</span>}
          </span>
        );
      })}
    </div>
  );
}

export function PlayerView({
  state: rawState,
  rules,
  me,
  round,
  place,
  remove,
  act,
}: PlayerViewProps) {
  const state = normalizeViewState(rawState);
  const amount = useStake();
  const [selectedBetId, setSelectedBetId] = useState<string | null>(null);
  const roundId = round.id;
  const puckOn = state.phase === "point" && state.point !== null;
  const shooterLabel = state.seriesLabel ?? "Shooter";
  const shooter = isShooter(me, state);
  const passSideLine = me.openBets.some((b) => b.type === "pass")
    ? "pass"
    : me.openBets.some((b) => b.type === "come")
      ? "come"
      : null;
  const dontSideLine = me.openBets.some((b) => b.type === "dont_pass")
    ? "dont_pass"
    : me.openBets.some((b) => b.type === "dont_come")
      ? "dont_come"
      : null;
  const selectedBet = selectedBetId
    ? (me.openBets.find((b) => b.id === selectedBetId) as PlacedBet<CrapsBetTarget> | undefined)
    : undefined;

  const handleRoll = useCallback(() => fireRoll(act), [act]);

  useShakeToRoll(handleRoll, shooter);

  const handleRollClick = useCallback(async () => {
    await requestMotionPermission();
    handleRoll();
  }, [handleRoll]);

  const actionLabels = Object.fromEntries(crapsPlayerActions.map((a) => [a.id, a.label]));

  return (
    <div class="craps-player-view" data-testid="craps-player-view">
      <header class="craps-player-view__status" data-testid="player-status">
        {puckLabel(puckOn, state.point)} · Shooter: {shooterLabel}
        {shooter && (
          <span class="craps-player-view__turn-prompt" data-testid="shooter-prompt">
            {" "}
            · YOU HAVE THE DICE
          </span>
        )}
      </header>

      <div class="craps-player-view__place-grid">
        {POINTS.map((point) => (
          <PlaceBox
            key={point}
            point={point}
            state={state}
            rules={rules}
            me={me}
            roundId={roundId}
            amount={amount}
            place={place}
            onSelectBet={setSelectedBetId}
          />
        ))}
      </div>

      <div class="craps-player-view__line-row">
        <BetZone
          betId="come"
          label="COME"
          state={state}
          rules={rules}
          me={me}
          roundId={roundId}
          amount={amount}
          place={place}
        />
        <BetZone
          betId="dont_come"
          label="DON'T COME"
          state={state}
          rules={rules}
          me={me}
          roundId={roundId}
          amount={amount}
          place={place}
        />
        <BetZone
          betId="field"
          label="FIELD"
          state={state}
          rules={rules}
          me={me}
          roundId={roundId}
          amount={amount}
          place={place}
        />
      </div>

      <div class="craps-player-view__pass-row">
        <BetZone
          betId="pass"
          label="PASS LINE"
          state={state}
          rules={rules}
          me={me}
          roundId={roundId}
          amount={amount}
          place={place}
        />
        {passSideLine && (
          <button
            type="button"
            class="craps-player-view__odds"
            data-testid="bet-zone-pass_odds"
            onClick={() => {
              place(
                buildPlacePayload(
                  "pass_odds",
                  { kind: "attach", line: passSideLine },
                  amount,
                  me,
                  roundId,
                  rules,
                  state,
                ),
              );
            }}
          >
            ODDS ⛀{amount}
          </button>
        )}
        {dontSideLine && (
          <button
            type="button"
            class="craps-player-view__odds"
            data-testid="bet-zone-dont_odds"
            onClick={() => {
              place(
                buildPlacePayload(
                  "dont_odds",
                  { kind: "attach", line: dontSideLine },
                  amount,
                  me,
                  roundId,
                  rules,
                  state,
                ),
              );
            }}
          >
            LAY ODDS ⛀{amount}
          </button>
        )}
        <BetZone
          betId="dont_pass"
          label="DON'T PASS"
          state={state}
          rules={rules}
          me={me}
          roundId={roundId}
          amount={amount}
          place={place}
        />
      </div>

      <details class="craps-player-view__collapsible" data-testid="props-details">
        <summary>Props</summary>
        <div class="craps-player-view__collapsible-body">
          {PROP_BET_IDS.map((betId) => {
            if (betId.startsWith("horn_high_") && !rules.hornHigh) return null;
            const def = lookupBetDef(betId);
            if (!def) return null;
            if (betId === "hard") {
              return POINTS.filter((p) => p === 4 || p === 6 || p === 8 || p === 10).map(
                (point) => (
                  <BetZone
                    key={`hard-${point}`}
                    betId="hard"
                    label={`Hard ${point}`}
                    state={state}
                    rules={rules}
                    me={me}
                    roundId={roundId}
                    amount={amount}
                    place={place}
                    target={{ kind: "point", value: point }}
                  />
                ),
              );
            }
            return (
              <BetZone
                key={betId}
                betId={betId}
                label={def.label}
                state={state}
                rules={rules}
                me={me}
                roundId={roundId}
                amount={amount}
                place={place}
              />
            );
          })}
        </div>
      </details>

      <details class="craps-player-view__collapsible" data-testid="side-details">
        <summary>Side</summary>
        <div class="craps-player-view__collapsible-body">
          {SIDE_BET_IDS.map((betId) => {
            const def = lookupBetDef(betId);
            if (!def) return null;
            return (
              <BetZone
                key={betId}
                betId={betId}
                label={def.label}
                state={state}
                rules={rules}
                me={me}
                roundId={roundId}
                amount={amount}
                place={place}
              />
            );
          })}
        </div>
      </details>

      {selectedBet && (
        <div class="craps-player-view__working" data-testid="working-controls">
          <button
            type="button"
            data-testid="working-toggle"
            onClick={() => act({ kind: "toggle_working", betId: selectedBet.id })}
          >
            {actionLabels.toggle_working}
          </button>
          <button
            type="button"
            data-testid="working-press"
            onClick={() => act({ kind: "press", betId: selectedBet.id })}
          >
            {actionLabels.press}
          </button>
          <button
            type="button"
            data-testid="working-take-down"
            disabled={!canTakeDown(selectedBet, state)}
            onClick={() => remove(selectedBet.id)}
          >
            {actionLabels.take_down}
          </button>
        </div>
      )}

      {shooter && (
        <div class="craps-player-view__shooter" data-testid="shooter-controls">
          <button
            type="button"
            class="craps-player-view__roll-btn"
            data-testid="shooter-roll"
            onClick={handleRollClick}
          >
            ROLL
          </button>
          <button
            type="button"
            data-testid="shooter-pass-dice"
            onClick={() => act({ kind: "pass_dice" })}
          >
            {actionLabels.pass_dice}
          </button>
        </div>
      )}

      <HistoryStrip rolls={state.shooter.rolls} />
      {state.lastRoll && (
        <div class="craps-player-view__last-roll" data-testid="last-roll-dice">
          <DicePair a={state.lastRoll.a} b={state.lastRoll.b} testId="last-roll-dice-faces" />
          <span>{state.lastRoll.total}</span>
        </div>
      )}
    </div>
  );
}
